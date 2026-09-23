import * as http from 'node:http';
import * as https from 'node:https';
import * as AWSXRay from 'aws-xray-sdk-core';

export type XrayContextMissingStrategy =
  | 'RUNTIME_ERROR'
  | 'LOG_ERROR'
  | 'IGNORE_ERROR';

export interface AwsObservabilityBootstrapOptions {
  /** Ignored when AWS_XRAY_CONTEXT_MISSING is set; the SDK locks that value when it loads. */
  contextMissingStrategy?: XrayContextMissingStrategy;
  /**
   * Captures outbound calls on the global http/https modules. The SDK adds an
   * X-Amzn-Trace-Id header to every captured request, third-party hosts included.
   */
  captureHttp?: boolean;
  captureHttps?: boolean;
  /**
   * Marks captured outbound calls as going to X-Ray-instrumented services. Enable
   * only when downstream HTTP traffic is to your own traced services.
   */
  downstreamXrayEnabled?: boolean;
  captureAwsSdkV2?: boolean;
  capturePromise?: boolean;
}

let bootstrapped = false;

export function resetAwsObservabilityBootstrapForTests(): void {
  bootstrapped = false;
}

/**
 * Configures AWS X-Ray before NestJS and application dependencies load.
 * Call this from an instrumentation file or as the first statement in main.ts.
 */
export function bootstrapAwsObservability(
  options: AwsObservabilityBootstrapOptions = {},
): void {
  if (bootstrapped) return;
  bootstrapped = true;

  AWSXRay.setContextMissingStrategy(
    options.contextMissingStrategy ?? 'LOG_ERROR',
  );

  if (options.capturePromise !== false) {
    AWSXRay.capturePromise();
  }

  const downstreamXrayEnabled = options.downstreamXrayEnabled === true;

  if (options.captureHttp !== false) {
    AWSXRay.captureHTTPsGlobal(http, downstreamXrayEnabled);
  }

  if (options.captureHttps !== false) {
    AWSXRay.captureHTTPsGlobal(https, downstreamXrayEnabled);
  }

  if (options.captureAwsSdkV2 === true) {
    AWSXRay.captureAWS(require('aws-sdk'));
  }
}

/**
 * AWS SDK v3 clients are captured per client instance. Wrap clients immediately
 * after construction and before first use.
 */
export interface AwsV3ClientLike {
  middlewareStack: {
    remove: unknown;
    use: unknown;
  };
  config: unknown;
}

export function captureAwsV3Client<TClient extends AwsV3ClientLike>(
  client: TClient,
): TClient {
  return AWSXRay.captureAWSv3Client(client) as TClient;
}
