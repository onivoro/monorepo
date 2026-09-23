import { Inject, Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { Unit } from 'aws-embedded-metrics';
import type { NextFunction, Request, Response } from 'express';
import {
  DEFAULT_HTTP_METRICS_CONFIG,
  ServerAwsObservabilityConfig,
} from '../aws-observability-config.interface';
import { SERVER_AWS_OBSERVABILITY_CONFIG } from '../aws-observability.constants';
import { MetricsService } from './metrics.service';

/**
 * Records one set of HTTP metrics per request when the response finishes or
 * the connection closes. Running as middleware means requests rejected by
 * guards, pipes, or other middleware are counted with their final status, and
 * streamed responses are timed to the end of the stream.
 */
@Injectable()
export class HttpMetricsMiddleware implements NestMiddleware {
  private readonly logger = new Logger(HttpMetricsMiddleware.name);
  private readonly httpMetrics: Required<
    NonNullable<ServerAwsObservabilityConfig['httpMetrics']>
  >;

  constructor(
    @Inject(SERVER_AWS_OBSERVABILITY_CONFIG)
    config: ServerAwsObservabilityConfig,
    private readonly metrics: MetricsService,
  ) {
    this.httpMetrics = {
      ...DEFAULT_HTTP_METRICS_CONFIG,
      ...(config.httpMetrics ?? {}),
    };
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.httpMetrics.enabled) {
      next();
      return;
    }

    const startedAt = Date.now();
    // Nest mounts middleware as an Express route, so req.route here is this
    // middleware's own route; if it is unchanged at the end, no handler matched.
    const middlewareRoute: unknown = req.route;
    let recorded = false;

    const record = (): void => {
      if (recorded) return;
      recorded = true;
      const route = req.route === middlewareRoute ? undefined : req.route;
      this.emitMetrics(
        req.method,
        route,
        req.baseUrl,
        res.statusCode,
        Date.now() - startedAt,
      ).catch((error: unknown) => {
        this.logger.warn(
          `Failed to emit HTTP metrics: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    };

    res.once('finish', record);
    res.once('close', record);
    next();
  }

  private async emitMetrics(
    method: string,
    route: { path?: unknown } | undefined,
    baseUrl: string,
    statusCode: number,
    durationMs: number,
  ): Promise<void> {
    const routePath =
      typeof route?.path === 'string'
        ? `${baseUrl || ''}${route.path}`
        : 'unmatched';
    const dimensions = {
      Method: method,
      ...(this.httpMetrics.includeRoute ? { Route: routePath } : {}),
      ...(this.httpMetrics.includeStatusCode
        ? { StatusCodeClass: `${Math.floor(statusCode / 100)}xx` }
        : {}),
    };

    await this.metrics.putMetrics(
      [
        { name: 'HttpRequestCount', value: 1, unit: Unit.Count },
        {
          name: 'HttpRequestDurationMs',
          value: durationMs,
          unit: Unit.Milliseconds,
        },
        ...(statusCode >= 500
          ? [{ name: 'HttpRequestErrorCount', value: 1, unit: Unit.Count }]
          : []),
      ],
      { dimensions },
    );
  }
}
