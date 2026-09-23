import { Inject, Injectable } from '@nestjs/common';
import { metricScope, Unit } from 'aws-embedded-metrics';
import { ServerAwsObservabilityConfig } from '../aws-observability-config.interface';
import { SERVER_AWS_OBSERVABILITY_CONFIG } from '../aws-observability.constants';
import {
  MetricDatum,
  MetricDimensions,
  MetricsServiceLike,
  PutMetricOptions,
} from './metrics-service.interface';

@Injectable()
export class MetricsService implements MetricsServiceLike {
  constructor(
    @Inject(SERVER_AWS_OBSERVABILITY_CONFIG)
    private readonly config: ServerAwsObservabilityConfig,
  ) {}

  async putMetric(
    name: string,
    value: number,
    unit: Unit,
    options: PutMetricOptions = {},
  ): Promise<void> {
    await this.putMetrics([{ name, value, unit }], options);
  }

  /** Emits several metrics sharing one dimension set as a single EMF record. */
  async putMetrics(
    metrics: MetricDatum[],
    options: PutMetricOptions = {},
  ): Promise<void> {
    if (metrics.length === 0) return;

    const dimensions = this.normalizeDimensions({
      Service: this.config.serviceName,
      ...(this.config.environment
        ? { Environment: this.config.environment }
        : {}),
      ...(this.config.defaultDimensions ?? {}),
      ...(options.dimensions ?? {}),
    });
    const properties = this.normalizeProperties(options.properties ?? {});

    const emit = metricScope((logger) => async (): Promise<void> => {
      logger.setNamespace(this.config.metricsNamespace);
      logger.putDimensions(dimensions);
      for (const [key, propertyValue] of Object.entries(properties)) {
        logger.setProperty(key, propertyValue);
      }
      for (const { name, value, unit } of metrics) {
        logger.putMetric(name, value, unit);
      }
    });

    await emit();
  }

  async count(
    name: string,
    value = 1,
    dimensions?: MetricDimensions,
  ): Promise<void> {
    await this.putMetric(name, value, Unit.Count, { dimensions });
  }

  async gauge(
    name: string,
    value: number,
    dimensions?: MetricDimensions,
  ): Promise<void> {
    await this.putMetric(name, value, Unit.None, { dimensions });
  }

  async duration(
    name: string,
    durationMs: number,
    dimensions?: MetricDimensions,
  ): Promise<void> {
    await this.putMetric(name, durationMs, Unit.Milliseconds, { dimensions });
  }

  private normalizeDimensions(
    dimensions: MetricDimensions,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(dimensions)) {
      if (value === undefined || value === null) continue;
      out[key] = String(value);
    }
    return out;
  }

  private normalizeProperties(
    properties: PutMetricOptions['properties'],
  ): Record<string, string | number | boolean> {
    const out: Record<string, string | number | boolean> = {};
    for (const [key, value] of Object.entries(properties ?? {})) {
      if (value === undefined || value === null) continue;
      out[key] = value;
    }
    return out;
  }
}
