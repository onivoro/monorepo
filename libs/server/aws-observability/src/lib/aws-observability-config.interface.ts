export interface ServerAwsObservabilityXrayConfig {
  enabled?: boolean;
  segmentName?: string;
  excludePaths?: string[];
}

export interface ServerAwsObservabilityHttpMetricsConfig {
  enabled?: boolean;
  includeRoute?: boolean;
  includeStatusCode?: boolean;
}

export interface ServerAwsObservabilityConfig {
  serviceName: string;
  environment?: string;
  metricsNamespace: string;
  defaultDimensions?: Record<string, string>;
  xray?: ServerAwsObservabilityXrayConfig;
  httpMetrics?: ServerAwsObservabilityHttpMetricsConfig;
}

export const DEFAULT_HTTP_METRICS_CONFIG: Required<ServerAwsObservabilityHttpMetricsConfig> =
  {
    enabled: false,
    includeRoute: true,
    includeStatusCode: true,
  };
