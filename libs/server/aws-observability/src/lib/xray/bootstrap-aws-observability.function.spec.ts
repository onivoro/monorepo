import * as AWSXRay from 'aws-xray-sdk-core';
import * as http from 'node:http';
import * as https from 'node:https';
import {
  bootstrapAwsObservability,
  captureAwsV3Client,
  resetAwsObservabilityBootstrapForTests,
} from './bootstrap-aws-observability.function';

jest.mock('aws-xray-sdk-core', () => ({
  setContextMissingStrategy: jest.fn(),
  capturePromise: jest.fn(),
  captureHTTPsGlobal: jest.fn((mod: unknown) => mod),
  captureAWS: jest.fn(),
  captureAWSv3Client: jest.fn((client: unknown) => client),
}));

const mockAwsSdkV2 = { config: {} };
jest.mock('aws-sdk', () => mockAwsSdkV2, { virtual: true });

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

  it('captures the global http and https modules', () => {
    bootstrapAwsObservability();

    expect(AWSXRay.captureHTTPsGlobal).toHaveBeenCalledWith(http, false);
    expect(AWSXRay.captureHTTPsGlobal).toHaveBeenCalledWith(https, false);
  });

  it('can capture https without http', () => {
    bootstrapAwsObservability({ captureHttp: false });

    expect(AWSXRay.captureHTTPsGlobal).toHaveBeenCalledTimes(1);
    expect(AWSXRay.captureHTTPsGlobal).toHaveBeenCalledWith(https, false);
  });

  it('does not touch the v2 SDK unless asked', () => {
    bootstrapAwsObservability();

    expect(AWSXRay.captureAWS).not.toHaveBeenCalled();
  });

  it('captures the v2 SDK when asked', () => {
    bootstrapAwsObservability({ captureAwsSdkV2: true });

    expect(AWSXRay.captureAWS).toHaveBeenCalledWith(mockAwsSdkV2);
  });

  it('bootstraps again after a reset', () => {
    bootstrapAwsObservability();
    resetAwsObservabilityBootstrapForTests();
    bootstrapAwsObservability();

    expect(AWSXRay.capturePromise).toHaveBeenCalledTimes(2);
  });
});

describe('captureAwsV3Client', () => {
  it('returns the client captured by X-Ray', () => {
    const client = {
      middlewareStack: { remove: jest.fn(), use: jest.fn() },
      config: {},
    };
    const captured = { ...client, captured: true };
    (AWSXRay.captureAWSv3Client as jest.Mock).mockReturnValueOnce(captured);

    expect(captureAwsV3Client(client)).toBe(captured);
    expect(AWSXRay.captureAWSv3Client).toHaveBeenCalledWith(client);
  });
});
