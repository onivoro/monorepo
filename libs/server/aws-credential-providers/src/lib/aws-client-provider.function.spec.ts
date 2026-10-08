import { awsClientProvider } from './aws-client-provider.function';
import { AwsCredentials } from './aws-credentials.class';

class FakeClient {
  constructor(public readonly config: any) {}
}

describe(awsClientProvider.name, () => {
  const credentials: AwsCredentials = {
    accessKeyId: 'AKIA',
    secretAccessKey: 'SECRET',
  };

  it('provides the client class and injects AwsCredentials', () => {
    const provider = awsClientProvider(FakeClient, { AWS_REGION: 'us-east-1' });

    expect(provider.provide).toBe(FakeClient);
    expect(provider.inject).toEqual([AwsCredentials]);
  });

  it('builds the client with the configured region and credentials', () => {
    const provider = awsClientProvider(FakeClient, { AWS_REGION: 'us-west-2' });

    const client = provider.useFactory(credentials);

    expect(client).toBeInstanceOf(FakeClient);
    expect(client.config).toEqual({ region: 'us-west-2', credentials });
  });

  it.each([undefined, null])(
    'passes credentials as undefined when they resolve to %p',
    (resolved) => {
      const provider = awsClientProvider(FakeClient, {
        AWS_REGION: 'us-east-1',
      });

      const client = provider.useFactory(resolved as any);

      expect(client.config).toHaveProperty('credentials', undefined);
      expect(client.config.region).toBe('us-east-1');
    },
  );

  it('merges extras into the client config, letting them override defaults', () => {
    const provider = awsClientProvider(
      FakeClient,
      { AWS_REGION: 'us-east-1' },
      { endpoint: 'http://localhost:4566', region: 'eu-west-1' },
    );

    const client = provider.useFactory(credentials);

    expect(client.config).toEqual({
      region: 'eu-west-1',
      credentials,
      endpoint: 'http://localhost:4566',
    });
  });

  it('creates a new client instance on every factory call', () => {
    const provider = awsClientProvider(FakeClient, { AWS_REGION: 'us-east-1' });

    expect(provider.useFactory(credentials)).not.toBe(
      provider.useFactory(credentials),
    );
  });
});
