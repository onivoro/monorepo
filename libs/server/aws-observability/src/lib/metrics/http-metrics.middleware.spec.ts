import {
  BadRequestException,
  CanActivate,
  Controller,
  Get,
  INestApplication,
  Injectable,
  Logger,
  Module,
  Param,
  UseGuards,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { EventEmitter } from 'node:events';
import type { Request, Response } from 'express';
import { Unit } from 'aws-embedded-metrics';
import { ServerAwsObservabilityModule } from '../aws-observability.module';
import { MetricDatum, PutMetricOptions } from './metrics-service.interface';
import { MetricsService } from './metrics.service';
import { HttpMetricsMiddleware } from './http-metrics.middleware';

jest.mock('aws-embedded-metrics', () => ({
  Unit: { Count: 'Count', Milliseconds: 'Milliseconds', None: 'None' },
  metricScope: jest.fn(),
}));

@Injectable()
class DenyGuard implements CanActivate {
  canActivate(): boolean {
    return false;
  }
}

@Controller('work')
class WorkController {
  @Get(':id')
  get(@Param('id') id: string): { id: string } {
    if (id === 'bad') throw new BadRequestException();
    if (id === 'boom') throw new Error('boom');
    return { id };
  }

  @Get('guarded/:id')
  @UseGuards(DenyGuard)
  guarded(): string {
    return 'unreachable';
  }
}

@Module({
  imports: [
    ServerAwsObservabilityModule.configure({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
      xray: { enabled: false },
      httpMetrics: { enabled: true },
    }),
  ],
  controllers: [WorkController],
})
class TestAppModule {}

describe('HttpMetricsMiddleware', () => {
  const putMetrics = jest.fn<
    Promise<void>,
    [MetricDatum[], PutMetricOptions?]
  >();
  let app: INestApplication;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    })
      .overrideProvider(MetricsService)
      .useValue({ putMetrics })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    await app.listen(0);
    baseUrl = await app.getUrl();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    putMetrics.mockReset();
    putMetrics.mockResolvedValue(undefined);
  });

  async function request(
    path: string,
  ): Promise<{ status: number; metrics: MetricDatum[]; dimensions: unknown }> {
    const response = await fetch(`${baseUrl}${path}`);
    await response.text();
    // The metrics are recorded on the response 'finish' event.
    for (let i = 0; i < 50 && putMetrics.mock.calls.length === 0; i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(putMetrics).toHaveBeenCalledTimes(1);
    const [metrics, options] = putMetrics.mock.calls[0];
    return {
      status: response.status,
      metrics,
      dimensions: options?.dimensions,
    };
  }

  const names = (metrics: MetricDatum[]) => metrics.map((m) => m.name);

  it('records successful requests with the matched route template', async () => {
    const result = await request('/api/work/42');

    expect(result.status).toBe(200);
    expect(result.dimensions).toEqual({
      Method: 'GET',
      Route: '/api/work/:id',
      StatusCodeClass: '2xx',
    });
    expect(names(result.metrics)).toEqual([
      'HttpRequestCount',
      'HttpRequestDurationMs',
    ]);
    expect(result.metrics[1]).toEqual({
      name: 'HttpRequestDurationMs',
      value: expect.any(Number),
      unit: Unit.Milliseconds,
    });
  });

  it('classifies client errors as 4xx without counting them as errors', async () => {
    const result = await request('/api/work/bad');

    expect(result.status).toBe(400);
    expect(result.dimensions).toMatchObject({ StatusCodeClass: '4xx' });
    expect(names(result.metrics)).not.toContain('HttpRequestErrorCount');
  });

  it('counts unhandled errors as 5xx server errors', async () => {
    const result = await request('/api/work/boom');

    expect(result.status).toBe(500);
    expect(result.dimensions).toMatchObject({ StatusCodeClass: '5xx' });
    expect(names(result.metrics)).toContain('HttpRequestErrorCount');
  });

  it('records requests rejected by guards', async () => {
    const result = await request('/api/work/guarded/1');

    expect(result.status).toBe(403);
    expect(result.dimensions).toEqual({
      Method: 'GET',
      Route: '/api/work/guarded/:id',
      StatusCodeClass: '4xx',
    });
  });

  it('labels requests that match no handler as unmatched', async () => {
    const result = await request('/api/missing');

    expect(result.status).toBe(404);
    expect(result.dimensions).toMatchObject({
      Route: 'unmatched',
      StatusCodeClass: '4xx',
    });
  });

  it('logs instead of failing when metrics cannot be emitted', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    putMetrics.mockRejectedValue(new Error('sink unavailable'));

    const result = await request('/api/work/42');
    await new Promise((resolve) => setImmediate(resolve));

    expect(result.status).toBe(200);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('sink unavailable'),
    );
    warn.mockRestore();
  });
});

describe('HttpMetricsMiddleware (unit)', () => {
  const putMetrics = jest.fn().mockResolvedValue(undefined);
  const metrics = { putMetrics } as unknown as MetricsService;
  const middlewareRoute = { path: '*' };

  const create = (
    httpMetrics?: ConstructorParameters<
      typeof HttpMetricsMiddleware
    >[0]['httpMetrics'],
  ) =>
    new HttpMetricsMiddleware(
      { serviceName: 'api', metricsNamespace: 'Onivoro/API', httpMetrics },
      metrics,
    );

  const exchange = (statusCode = 200) => {
    const req = {
      method: 'POST',
      baseUrl: '/api',
      route: middlewareRoute,
    } as unknown as Request & { route: unknown };
    const res = Object.assign(new EventEmitter(), {
      statusCode,
    }) as unknown as Response & EventEmitter;
    return { req, res };
  };

  beforeEach(() => putMetrics.mockClear());

  it('only calls next when metrics are disabled', () => {
    const { req, res } = exchange();
    const next = jest.fn();

    create().use(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(putMetrics).not.toHaveBeenCalled();
    expect(res.listenerCount('finish')).toBe(0);
  });

  it('records once even when both finish and close fire', () => {
    const { req, res } = exchange(201);
    const next = jest.fn();

    create({ enabled: true }).use(req, res, next);
    req.route = { path: '/items' };
    res.emit('finish');
    res.emit('close');

    expect(next).toHaveBeenCalledTimes(1);
    expect(putMetrics).toHaveBeenCalledTimes(1);
    expect(putMetrics.mock.calls[0][1]).toEqual({
      dimensions: {
        Method: 'POST',
        Route: '/api/items',
        StatusCodeClass: '2xx',
      },
    });
  });

  it('records on close when the client disconnects before finish', () => {
    const { req, res } = exchange(500);

    create({ enabled: true }).use(req, res, jest.fn());
    res.emit('close');

    expect(putMetrics).toHaveBeenCalledTimes(1);
    expect(putMetrics.mock.calls[0][1].dimensions).toMatchObject({
      Route: 'unmatched',
      StatusCodeClass: '5xx',
    });
  });

  it('measures the duration between the request and the response', () => {
    jest.useFakeTimers();
    try {
      const { req, res } = exchange();

      create({ enabled: true }).use(req, res, jest.fn());
      jest.advanceTimersByTime(42);
      res.emit('finish');

      expect(putMetrics.mock.calls[0][0]).toContainEqual({
        name: 'HttpRequestDurationMs',
        value: 42,
        unit: Unit.Milliseconds,
      });
    } finally {
      jest.useRealTimers();
    }
  });

  it('can omit the route and status code dimensions', () => {
    const { req, res } = exchange(404);

    create({
      enabled: true,
      includeRoute: false,
      includeStatusCode: false,
    }).use(req, res, jest.fn());
    res.emit('finish');

    expect(putMetrics.mock.calls[0][1]).toEqual({
      dimensions: { Method: 'POST' },
    });
  });

  it('uses the route path alone when there is no baseUrl', () => {
    const { req, res } = exchange();
    (req as { baseUrl: unknown }).baseUrl = undefined;

    create({ enabled: true }).use(req, res, jest.fn());
    req.route = { path: '/health' };
    res.emit('finish');

    expect(putMetrics.mock.calls[0][1].dimensions.Route).toBe('/health');
  });

  it('logs non-Error emit failures', async () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    putMetrics.mockRejectedValueOnce('nope');
    const { req, res } = exchange();

    create({ enabled: true }).use(req, res, jest.fn());
    res.emit('finish');
    await new Promise((resolve) => setImmediate(resolve));

    expect(warn).toHaveBeenCalledWith('Failed to emit HTTP metrics: nope');
    warn.mockRestore();
  });
});
