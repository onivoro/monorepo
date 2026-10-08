import { fromIni } from '@aws-sdk/credential-providers';
import { resolveAwsCredentialProvidersByProfile } from './resolve-aws-credential-providers-by-profile.function';

jest.mock('@aws-sdk/credential-providers', () => ({
  fromIni: jest.fn(),
}));

const mockFromIni = fromIni as jest.MockedFunction<typeof fromIni>;

const ENV_KEYS = [
  'AWS_ACCESS_KEY_ID',
  'AWS_SECRET_ACCESS_KEY',
  'aws_access_key_id',
  'aws_secret_access_key',
];

describe(resolveAwsCredentialProvidersByProfile.name, () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (savedEnv[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = savedEnv[key];
      }
    }
    jest.restoreAllMocks();
    mockFromIni.mockReset();
  });

  it.each([undefined, ''])(
    'returns undefined without consulting fromIni when profile is %p',
    async (profile) => {
      process.env['AWS_ACCESS_KEY_ID'] = 'ENV_KEY';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'ENV_SECRET';

      await expect(
        resolveAwsCredentialProvidersByProfile(profile),
      ).resolves.toBeUndefined();
      expect(mockFromIni).not.toHaveBeenCalled();
    },
  );

  it('resolves credentials from the named profile via fromIni', async () => {
    const credentials = { accessKeyId: 'AKIA', secretAccessKey: 'SECRET' };
    const resolver = jest.fn().mockResolvedValue(credentials);
    mockFromIni.mockReturnValue(resolver as any);

    await expect(resolveAwsCredentialProvidersByProfile('dev')).resolves.toBe(
      credentials,
    );
    expect(mockFromIni).toHaveBeenCalledWith({ profile: 'dev' });
    expect(resolver).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      'attempting to use AWS profile "dev" for AWS authentication',
    );
  });

  describe('when the profile cannot be loaded', () => {
    beforeEach(() => {
      mockFromIni.mockReturnValue(
        jest.fn().mockRejectedValue(new Error('profile not found')) as any,
      );
    });

    it('warns about lowercase keys in the credentials file', async () => {
      await resolveAwsCredentialProvidersByProfile('missing');

      expect(console.warn).toHaveBeenLastCalledWith(
        'failed to load AWS profile "missing"... ensure that "aws_access_key_id" and "aws_secret_access_key" are lowercase in your ~/.aws/credentials file',
      );
    });

    it('falls back to UPPERCASE environment variables', async () => {
      process.env['AWS_ACCESS_KEY_ID'] = 'UPPER_KEY';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'UPPER_SECRET';

      await expect(
        resolveAwsCredentialProvidersByProfile('missing'),
      ).resolves.toEqual({
        accessKeyId: 'UPPER_KEY',
        secretAccessKey: 'UPPER_SECRET',
      });
      expect(console.log).toHaveBeenCalledWith(
        'using UPPERCASE AWS_* environment variables for AWS authentication',
      );
    });

    it('falls back to lowercase environment variables', async () => {
      process.env['aws_access_key_id'] = 'lower_key';
      process.env['aws_secret_access_key'] = 'lower_secret';

      await expect(
        resolveAwsCredentialProvidersByProfile('missing'),
      ).resolves.toEqual({
        accessKeyId: 'lower_key',
        secretAccessKey: 'lower_secret',
      });
      expect(console.log).toHaveBeenCalledWith(
        'using lowercase aws_* environment variables for AWS authentication',
      );
    });

    it('prefers UPPERCASE over lowercase environment variables', async () => {
      process.env['AWS_ACCESS_KEY_ID'] = 'UPPER_KEY';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'UPPER_SECRET';
      process.env['aws_access_key_id'] = 'lower_key';
      process.env['aws_secret_access_key'] = 'lower_secret';

      await expect(
        resolveAwsCredentialProvidersByProfile('missing'),
      ).resolves.toEqual({
        accessKeyId: 'UPPER_KEY',
        secretAccessKey: 'UPPER_SECRET',
      });
    });

    it('ignores an incomplete UPPERCASE pair and uses a complete lowercase pair', async () => {
      process.env['AWS_ACCESS_KEY_ID'] = 'UPPER_KEY';
      process.env['aws_access_key_id'] = 'lower_key';
      process.env['aws_secret_access_key'] = 'lower_secret';

      await expect(
        resolveAwsCredentialProvidersByProfile('missing'),
      ).resolves.toEqual({
        accessKeyId: 'lower_key',
        secretAccessKey: 'lower_secret',
      });
    });

    it.each([
      ['no environment variables', {}],
      ['only an UPPERCASE access key', { AWS_ACCESS_KEY_ID: 'K' }],
      ['only an UPPERCASE secret', { AWS_SECRET_ACCESS_KEY: 'S' }],
      ['only a lowercase access key', { aws_access_key_id: 'k' }],
      ['only a lowercase secret', { aws_secret_access_key: 's' }],
      [
        'mismatched case halves',
        { AWS_ACCESS_KEY_ID: 'K', aws_secret_access_key: 's' },
      ],
    ])('returns undefined with %s', async (_label, env) => {
      Object.assign(process.env, env);

      await expect(
        resolveAwsCredentialProvidersByProfile('missing'),
      ).resolves.toBeUndefined();
      expect(console.log).not.toHaveBeenCalled();
    });
  });

  it('falls back to environment variables when fromIni throws synchronously', async () => {
    mockFromIni.mockImplementation(() => {
      throw new Error('bad config');
    });
    process.env['AWS_ACCESS_KEY_ID'] = 'UPPER_KEY';
    process.env['AWS_SECRET_ACCESS_KEY'] = 'UPPER_SECRET';

    await expect(
      resolveAwsCredentialProvidersByProfile('broken'),
    ).resolves.toEqual({
      accessKeyId: 'UPPER_KEY',
      secretAccessKey: 'UPPER_SECRET',
    });
  });
});
