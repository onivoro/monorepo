import type { Unit } from 'aws-embedded-metrics';

export type MetricDimensions = Record<
  string,
  string | number | boolean | undefined | null
>;

export interface PutMetricOptions {
  dimensions?: MetricDimensions;
  properties?: Record<string, string | number | boolean | undefined | null>;
}

export interface MetricDatum {
  name: string;
  value: number;
  unit: Unit;
}

export interface MetricsServiceLike {
  putMetric(
    name: string,
    value: number,
    unit: Unit,
    options?: PutMetricOptions,
  ): Promise<void>;
  putMetrics(metrics: MetricDatum[], options?: PutMetricOptions): Promise<void>;
  count(
    name: string,
    value?: number,
    dimensions?: MetricDimensions,
  ): Promise<void>;
  gauge(
    name: string,
    value: number,
    dimensions?: MetricDimensions,
  ): Promise<void>;
  duration(
    name: string,
    durationMs: number,
    dimensions?: MetricDimensions,
  ): Promise<void>;
}
