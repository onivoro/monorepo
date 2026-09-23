# @onivoro/server-aws-observability

Focused AWS observability helpers for NestJS services.

## Features

- AWS X-Ray tracing for inbound HTTP requests.
- Pre-Nest bootstrap for X-Ray monkey-patching that must run before app imports.
- Helpers for AWS SDK v3 client capture.
- CloudWatch Embedded Metric Format custom metrics.
- Optional HTTP request count, duration, and error metrics.
- X-Ray trace fields for application log correlation.

## Install

```bash
npm install @onivoro/server-aws-observability aws-xray-sdk-core aws-xray-sdk-express aws-embedded-metrics
```

## Required Bootstrap Order

Auto-instrumentation must run before NestJS and application dependencies are loaded. Prefer a small `instrumentation.ts` imported as the first line of `main.ts`.

```ts
// instrumentation.ts
import { bootstrapAwsObservability } from '@onivoro/server-aws-observability/bootstrap';

bootstrapAwsObservability();
```

In a Nx app inside this monorepo the `/bootstrap` entry point resolves through the `tsconfig.base.json` path mapping.

```ts
// main.ts
import './instrumentation';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  await app.listen(3000);
}

bootstrap();
```

The Nest module alone is not enough for outbound HTTP, AWS SDK, or database auto-instrumentation because those libraries may already be loaded by the time Nest constructs modules.

## Nest Module

```ts
import { Module } from '@nestjs/common';
import { ServerAwsObservabilityModule } from '@onivoro/server-aws-observability';

@Module({
  imports: [
    ServerAwsObservabilityModule.configure({
      serviceName: 'app-server-ehr',
      environment: 'qa',
      metricsNamespace: 'Silver/EHR',
      xray: {
        enabled: true,
        segmentName: 'app-server-ehr',
        // Matched against the full request path, including any global prefix.
        excludePaths: ['/api/health', '/api/health/ready'],
      },
      httpMetrics: {
        enabled: true,
      },
    }),
  ],
})
export class AppModule {}
```

The segment name defaults to `xray.segmentName`, then `serviceName`. If `AWS_XRAY_TRACING_NAME` is set when the X-Ray SDK loads, it overrides both.

Handled client errors (`HttpException` with a 4xx status) are not recorded as X-Ray faults; X-Ray flags them as errors from the response status.

## HTTP Metrics

With `httpMetrics.enabled`, a middleware records one EMF record per request when the response finishes or the connection closes:

- `HttpRequestCount` and `HttpRequestDurationMs` for every request.
- `HttpRequestErrorCount` for 5xx responses only.

Because it runs as middleware, it also records requests rejected by guards, pipes, or other middleware, using the final response status. Streamed responses are counted once and timed to the end of the stream. Requests that match no handler use the route `unmatched`.

Dimensions are `Service`, `Environment`, any `defaultDimensions`, `Method`, `Route` (the route template, such as `/api/work/:id`), and `StatusCodeClass` (`2xx`, `4xx`, ...). CloudWatch bills each unique dimension combination as a separate custom metric, so a service with 40 routes can produce several hundred metrics. Set `includeRoute: false` if that cost is not worth the per-route breakdown.

## AWS SDK v3 Clients

AWS SDK v3 capture is per client instance. Wrap clients immediately after construction and before first use.

```ts
import { S3Client } from '@aws-sdk/client-s3';
import { captureAwsV3Client } from '@onivoro/server-aws-observability/bootstrap';

const s3 = captureAwsV3Client(new S3Client({ region: 'us-east-2' }));
```

AWS SDK v2 global capture is available but disabled by default because most Onivoro services use SDK v3. It requires `aws-sdk` to be installed:

```ts
bootstrapAwsObservability({
  captureAwsSdkV2: true,
});
```

## Outbound HTTP

The bootstrap captures the global `http` and `https` modules by default. The X-Ray SDK then adds an `X-Amzn-Trace-Id` header to every outbound request, including requests to third-party APIs. If that is a concern, turn off `captureHttp` / `captureHttps`.

Set `downstreamXrayEnabled: true` only when outbound HTTP goes to your own X-Ray-traced services; it marks those calls as traced in the service map.

## Custom Metrics

Metrics are emitted in CloudWatch Embedded Metric Format. Where they go depends on the environment `aws-embedded-metrics` detects:

- Lambda: stdout, extracted by CloudWatch Logs automatically.
- ECS and EC2: a CloudWatch agent over TCP/UDP. Without an agent, every flush fails. To write to stdout through the `awslogs` driver instead, set `AWS_EMF_ENVIRONMENT=Local`.

HTTP metric failures are logged as warnings and never fail the request.

```ts
import { Injectable } from '@nestjs/common';
import { MetricsService } from '@onivoro/server-aws-observability';

@Injectable()
export class WorkerService {
  constructor(private readonly metrics: MetricsService) {}

  async run() {
    await this.metrics.count('WorkItemProcessed', 1, { Queue: 'default' });
    await this.metrics.duration('WorkItemDurationMs', 42, { Queue: 'default' });
  }
}
```

Avoid high-cardinality dimensions such as user IDs, request IDs, raw URLs, query strings, and customer-specific identifiers unless you have explicitly accepted the CloudWatch cost and cardinality impact.

## Log Correlation

For Pino, use the mixin helper:

```ts
import { pinoXrayMixin } from '@onivoro/server-aws-observability';

pino({
  mixin: pinoXrayMixin(),
});
```

When a segment is active, log records receive the fields below. Outside a trace (startup, background jobs, excluded paths) the mixin returns nothing and does not trigger X-Ray's context-missing logging.

- `xray_trace_id`
- `xray_segment_id`

## AWS Runtime Requirements

ECS:

- Run the X-Ray daemon as a sidecar or provide a compatible X-Ray endpoint.
- Set `AWS_XRAY_DAEMON_ADDRESS`, commonly `127.0.0.1:2000`.
- Configure app logs through the `awslogs` driver.
- Set `AWS_EMF_ENVIRONMENT=Local` so EMF metrics go to stdout, or run a CloudWatch agent sidecar.
- Attach X-Ray permissions to the task role.
- Ensure CloudWatch Logs permissions exist on the execution role for stdout logs and EMF ingestion.

Lambda:

- Enable active tracing.
- Ensure the function role has X-Ray write permissions.
- CloudWatch logs and EMF metrics flow through Lambda stdout.

Common environment variables:

```txt
AWS_XRAY_CONTEXT_MISSING=LOG_ERROR
AWS_XRAY_DAEMON_ADDRESS=127.0.0.1:2000
AWS_EMF_ENVIRONMENT=Local
```

`AWS_XRAY_CONTEXT_MISSING` takes precedence over the `contextMissingStrategy` bootstrap option. Set `AWS_XRAY_TRACING_NAME` only if you want it to override the module's `segmentName`.

## Terraform Examples

See `examples/terraform/ecs-xray.tf`, `examples/terraform/lambda-xray.tf`, and `examples/terraform/cloudwatch-dashboard.tf` for baseline IAM/runtime/dashboard snippets.
