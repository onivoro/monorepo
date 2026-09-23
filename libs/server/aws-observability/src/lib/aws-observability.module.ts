import {
  DynamicModule,
  Inject,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ServerAwsObservabilityConfig } from './aws-observability-config.interface';
import { SERVER_AWS_OBSERVABILITY_CONFIG } from './aws-observability.constants';
import { HttpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { MetricsService } from './metrics/metrics.service';
import { XrayErrorInterceptor } from './xray/xray-error.interceptor';
import { XrayMiddleware } from './xray/xray.middleware';

@Module({})
export class ServerAwsObservabilityModule implements NestModule {
  constructor(
    @Inject(SERVER_AWS_OBSERVABILITY_CONFIG)
    private readonly config: ServerAwsObservabilityConfig,
  ) {}

  static configure(config: ServerAwsObservabilityConfig): DynamicModule {
    return {
      module: ServerAwsObservabilityModule,
      providers: [
        { provide: SERVER_AWS_OBSERVABILITY_CONFIG, useValue: config },
        MetricsService,
        ...(config.xray?.enabled === false
          ? []
          : [{ provide: APP_INTERCEPTOR, useClass: XrayErrorInterceptor }]),
      ],
      exports: [SERVER_AWS_OBSERVABILITY_CONFIG, MetricsService],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    // X-Ray first, so the segment is open for everything downstream.
    const middleware = [
      ...(this.config.xray?.enabled === false ? [] : [XrayMiddleware]),
      ...(this.config.httpMetrics?.enabled ? [HttpMetricsMiddleware] : []),
    ];
    if (middleware.length > 0) {
      consumer
        .apply(...middleware)
        .forRoutes({ path: '*', method: RequestMethod.ALL });
    }
  }
}
