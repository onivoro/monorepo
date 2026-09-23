export type {
  AwsObservabilityBootstrapOptions,
  AwsV3ClientLike,
  XrayContextMissingStrategy,
} from './lib/xray/bootstrap-aws-observability.function';
export {
  bootstrapAwsObservability,
  captureAwsV3Client,
} from './lib/xray/bootstrap-aws-observability.function';
