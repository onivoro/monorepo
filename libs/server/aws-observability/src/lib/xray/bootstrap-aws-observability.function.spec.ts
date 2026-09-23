import * as AWSXRay from 'aws-xray-sdk-core';
import {
  bootstrapAwsObservability,
  resetAwsObservabilityBootstrapForTests,
} from './bootstrap-aws-observability.function';

jest.mock('aws-xray-sdk-core', () => ({
  setContextMissingStrategy: jest.fn(),
  capturePromise: jest.fn(),
  captureHTTPsGlobal: jest.fn((mod: unknown) => mod),
  captureAWS: jest.fn(),
  captureAWSv3Client: jest.fn((client: unknown) => client),
}));

describe('bootstrapAwsObservability', () => {
  beforeEach(() => {
    resetAwsObservabilityBootstrapForTests();
    jest.clearAllMocks();
  });

  it('configures X-Ray before Nest starts', async () => {
    bootstrapAwsObservability();

    expect(AWSXRay.setContextMissingStrategy).toHaveBeenCalledWith('LOG_ERROR');
    expect(AWSXRay.capturePromise).toHaveBeenCalledTimes(1);
    expect(AWSXRay.captureHTTPsGlobal).toHaveBeenCalledTimes(2);
    expect(AWSXRay.captureHTTPsGlobal).toHaveBeenCalledWith(
      expect.anything(),
      false,
    );
  });

  it('marks downstream calls as traced only when asked', async () => {
    bootstrapAwsObservability({ downstreamXrayEnabled: true });

    expect(AWSXRay.captureHTTPsGlobal).toHaveBeenCalledWith(
      expect.anything(),
      true,
    );
  });

  it('passes the configured context missing strategy to the SDK', async () => {
    bootstrapAwsObservability({ contextMissingStrategy: 'IGNORE_ERROR' });

    expect(AWSXRay.setContextMissingStrategy).toHaveBeenCalledWith(
      'IGNORE_ERROR',
    );
  });

  it('respects disabled capture options', async () => {
    bootstrapAwsObservability({
      capturePromise: false,
      captureHttp: false,
      captureHttps: false,
    });

    expect(AWSXRay.capturePromise).not.toHaveBeenCalled();
    expect(AWSXRay.captureHTTPsGlobal).not.toHaveBeenCalled();
  });

  it('only bootstraps once', async () => {
    bootstrapAwsObservability();
    bootstrapAwsObservability();

    expect(AWSXRay.capturePromise).toHaveBeenCalledTimes(1);
  });
});
