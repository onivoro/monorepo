import { Test } from '@nestjs/testing';
import { fromIni } from '@aws-sdk/credential-providers';
import { ServerAwsCredentialProvidersModule } from './server-aws-credential-providers.module';
import { ServerAwsCredentialProvidersConfig } from './server-aws-credential-providers-config.class';
import { AwsCredentials } from './aws-credentials.class';

jest.mock('@aws-sdk/credential-providers', () => ({
  fromIni: jest.fn(),
}));

const mockFromIni = fromIni as jest.MockedFunction<typeof fromIni>;

describe(ServerAwsCredentialProvidersModule.name, () => {
  afterEach(() => {
    mockFromIni.mockReset();
    jest.restoreAllMocks();
  });

  it('configure returns a dynamic module exporting credentials and config', () => {
    const config = { AWS_PROFILE: 'dev' };

    const dynamicModule = ServerAwsCredentialProvidersModule.configure(config);

    expect(dynamicModule.module).toBe(ServerAwsCredentialProvidersModule);
    expect(dynamicModule.exports).toEqual([
      AwsCredentials,
      ServerAwsCredentialProvidersConfig,
    ]);
    expect(dynamicModule.providers[0]).toEqual({
      provide: ServerAwsCredentialProvidersConfig,
      useValue: config,
    });
  });

  it('resolves credentials from the configured profile', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const credentials = { accessKeyId: 'AKIA', secretAccessKey: 'SECRET' };
    mockFromIni.mockReturnValue(
      jest.fn().mockResolvedValue(credentials) as any,
    );
    const config = { AWS_PROFILE: 'dev' };

    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsCredentialProvidersModule.configure(config)],
    }).compile();

    expect(moduleRef.get(ServerAwsCredentialProvidersConfig)).toBe(config);
    expect(moduleRef.get(AwsCredentials)).toBe(credentials);
    expect(mockFromIni).toHaveBeenCalledWith({ profile: 'dev' });
  });

  it('resolves undefined credentials when no profile is configured', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ServerAwsCredentialProvidersModule.configure({})],
    }).compile();

    expect(moduleRef.get(AwsCredentials)).toBeUndefined();
    expect(mockFromIni).not.toHaveBeenCalled();
  });
});
