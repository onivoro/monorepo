import { MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { ServerAwsObservabilityModule } from './aws-observability.module';
import { ServerAwsObservabilityConfig } from './aws-observability-config.interface';
import { SERVER_AWS_OBSERVABILITY_CONFIG } from './aws-observability.constants';
import { HttpMetricsMiddleware } from './metrics/http-metrics.middleware';
import { MetricsService } from './metrics/metrics.service';
import { XrayErrorInterceptor } from './xray/xray-error.interceptor';
import { XrayMiddleware } from './xray/xray.middleware';

jest.mock('aws-xray-sdk-express', () => ({
  openSegment: jest.fn(() => jest.fn()),
}));

describe(ServerAwsObservabilityModule.name, () => {
  const base: ServerAwsObservabilityConfig = {
    serviceName: 'api',
    metricsNamespace: 'Onivoro/API',
  };

  describe('static configure', () => {
    it('provides the config and MetricsService, plus the X-Ray interceptor by default', () => {
      const dynamicModule = ServerAwsObservabilityModule.configure(base);

      expect(dynamicModule.module).toBe(ServerAwsObservabilityModule);
      expect(dynamicModule.providers).toEqual([
        { provide: SERVER_AWS_OBSERVABILITY_CONFIG, useValue: base },
        MetricsService,
        { provide: APP_INTERCEPTOR, useClass: XrayErrorInterceptor },
      ]);
      expect(dynamicModule.exports).toEqual([
        SERVER_AWS_OBSERVABILITY_CONFIG,
        MetricsService,
      ]);
    });

    it('keeps the interceptor when xray is explicitly enabled', () => {
      const dynamicModule = ServerAwsObservabilityModule.configure({
        ...base,
        xray: { enabled: true },
      });

      expect(dynamicModule.providers).toContainEqual({
        provide: APP_INTERCEPTOR,
        useClass: XrayErrorInterceptor,
      });
    });

    it('omits the interceptor when xray is disabled', () => {
      const dynamicModule = ServerAwsObservabilityModule.configure({
        ...base,
        xray: { enabled: false },
      });

      expect(dynamicModule.providers).toHaveLength(2);
      expect(dynamicModule.providers).not.toContainEqual(
        expect.objectContaining({ provide: APP_INTERCEPTOR }),
      );
    });
  });

  describe('middleware configuration', () => {
    const consumerFor = () => {
      const forRoutes = jest.fn();
      const apply = jest.fn(() => ({ forRoutes }));
      return {
        consumer: { apply } as unknown as MiddlewareConsumer,
        apply,
        forRoutes,
      };
    };

    it.each([
      ['defaults', {}, [XrayMiddleware]],
      [
        'metrics enabled',
        { httpMetrics: { enabled: true } },
        [XrayMiddleware, HttpMetricsMiddleware],
      ],
      [
        'xray disabled and metrics enabled',
        { xray: { enabled: false }, httpMetrics: { enabled: true } },
        [HttpMetricsMiddleware],
      ],
      [
        'metrics explicitly disabled',
        { httpMetrics: { enabled: false } },
        [XrayMiddleware],
      ],
    ])(
      'applies the right middleware for %s, X-Ray first, on all routes',
      (_, overrides, expected) => {
        const { consumer, apply, forRoutes } = consumerFor();

        new ServerAwsObservabilityModule({ ...base, ...overrides }).configure(
          consumer,
        );

        expect(apply).toHaveBeenCalledWith(...expected);
        expect(forRoutes).toHaveBeenCalledWith({
          path: '*',
          method: RequestMethod.ALL,
        });
      },
    );

    it('applies nothing when both X-Ray and metrics are disabled', () => {
      const { consumer, apply } = consumerFor();

      new ServerAwsObservabilityModule({
        ...base,
        xray: { enabled: false },
      }).configure(consumer);

      expect(apply).not.toHaveBeenCalled();
    });
  });
});
