import { Unit } from 'aws-embedded-metrics';
import { MetricsService } from './metrics.service';

const metricsLogger = {
  setNamespace: jest.fn(),
  putDimensions: jest.fn(),
  setProperty: jest.fn(),
  putMetric: jest.fn(),
};

jest.mock('aws-embedded-metrics', () => ({
  Unit: {
    Count: 'Count',
    Milliseconds: 'Milliseconds',
    None: 'None',
  },
  metricScope: (
    factory: (metrics: typeof metricsLogger) => () => Promise<void>,
  ) => factory(metricsLogger),
}));

describe('MetricsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('emits EMF metrics with service, environment, default, and call dimensions', async () => {
    const service = new MetricsService({
      serviceName: 'api',
      environment: 'qa',
      metricsNamespace: 'Onivoro/API',
      defaultDimensions: { Team: 'platform' },
    });

    await service.putMetric('WorkDone', 3, Unit.Count, {
      dimensions: { Route: '/work', Empty: undefined },
      properties: { requestCount: 3, ignored: null },
    });

    expect(metricsLogger.setNamespace).toHaveBeenCalledWith('Onivoro/API');
    expect(metricsLogger.putDimensions).toHaveBeenCalledWith({
      Service: 'api',
      Environment: 'qa',
      Team: 'platform',
      Route: '/work',
    });
    expect(metricsLogger.setProperty).toHaveBeenCalledWith('requestCount', 3);
    expect(metricsLogger.putMetric).toHaveBeenCalledWith(
      'WorkDone',
      3,
      Unit.Count,
    );
  });

  it('emits several metrics in one EMF record', async () => {
    const service = new MetricsService({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
    });

    await service.putMetrics(
      [
        { name: 'A', value: 1, unit: Unit.Count },
        { name: 'B', value: 20, unit: Unit.Milliseconds },
      ],
      { dimensions: { Route: '/work' } },
    );

    expect(metricsLogger.putDimensions).toHaveBeenCalledTimes(1);
    expect(metricsLogger.putMetric).toHaveBeenCalledWith('A', 1, Unit.Count);
    expect(metricsLogger.putMetric).toHaveBeenCalledWith(
      'B',
      20,
      Unit.Milliseconds,
    );
  });

  it('emits nothing for an empty batch', async () => {
    const service = new MetricsService({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
    });

    await service.putMetrics([]);

    expect(metricsLogger.putDimensions).not.toHaveBeenCalled();
  });
});
