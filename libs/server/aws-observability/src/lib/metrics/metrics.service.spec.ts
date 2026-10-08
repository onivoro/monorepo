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

  describe('convenience helpers', () => {
    const service = new MetricsService({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
    });

    it('count defaults to 1 with Count unit', async () => {
      await service.count('Jobs');

      expect(metricsLogger.putMetric).toHaveBeenCalledWith(
        'Jobs',
        1,
        Unit.Count,
      );
      expect(metricsLogger.putDimensions).toHaveBeenCalledWith({
        Service: 'api',
      });
    });

    it('count accepts a value and dimensions', async () => {
      await service.count('Jobs', 4, { Queue: 'q', Shard: 2 });

      expect(metricsLogger.putMetric).toHaveBeenCalledWith(
        'Jobs',
        4,
        Unit.Count,
      );
      expect(metricsLogger.putDimensions).toHaveBeenCalledWith({
        Service: 'api',
        Queue: 'q',
        Shard: '2',
      });
    });

    it('gauge uses the None unit', async () => {
      await service.gauge('QueueDepth', 12, { Queue: 'q' });

      expect(metricsLogger.putMetric).toHaveBeenCalledWith(
        'QueueDepth',
        12,
        Unit.None,
      );
      expect(metricsLogger.putDimensions).toHaveBeenCalledWith({
        Service: 'api',
        Queue: 'q',
      });
    });

    it('duration uses the Milliseconds unit', async () => {
      await service.duration('Latency', 250);

      expect(metricsLogger.putMetric).toHaveBeenCalledWith(
        'Latency',
        250,
        Unit.Milliseconds,
      );
    });
  });

  it('lets call dimensions override service and default dimensions', async () => {
    const service = new MetricsService({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
      defaultDimensions: { Team: 'platform' },
    });

    await service.putMetric('X', 1, Unit.Count, {
      dimensions: { Team: 'payments', Service: 'worker' },
    });

    expect(metricsLogger.putDimensions).toHaveBeenCalledWith({
      Service: 'worker',
      Team: 'payments',
    });
    expect(metricsLogger.setProperty).not.toHaveBeenCalled();
  });

  it('keeps falsy property values other than null and undefined', async () => {
    const service = new MetricsService({
      serviceName: 'api',
      metricsNamespace: 'Onivoro/API',
    });

    await service.putMetric('X', 1, Unit.Count, {
      properties: { zero: 0, no: false, empty: '', gone: undefined },
    });

    expect(metricsLogger.setProperty.mock.calls).toEqual([
      ['zero', 0],
      ['no', false],
      ['empty', ''],
    ]);
  });
});
