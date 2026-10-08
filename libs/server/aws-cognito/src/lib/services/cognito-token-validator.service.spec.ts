import { generateKeyPairSync } from 'crypto';
import { sign, SignOptions } from 'jsonwebtoken';
import { CognitoTokenValidatorService } from './cognito-token-validator.service';
import { ServerAwsCognitoConfig } from '../server-aws-cognito-config.class';

const config: ServerAwsCognitoConfig = {
  AWS_REGION: 'us-east-1',
  COGNITO_USER_POOL_ID: 'us-east-1_pool',
  COGNITO_USER_POOL_CLIENT_ID: 'client-id',
};

const issuer = `https://cognito-idp.${config.AWS_REGION}.amazonaws.com/${config.COGNITO_USER_POOL_ID}`;

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
});
const kid = 'test-kid';

function makeToken(
  expiresIn: number,
  payload: Record<string, any> = {
    token_use: 'id',
    email: 'user@example.com',
  },
  options: SignOptions = {},
) {
  return sign(
    {
      ...payload,
      exp: Math.floor(Date.now() / 1000) + expiresIn,
    },
    privateKey,
    {
      algorithm: 'RS256',
      keyid: kid,
      issuer,
      audience: config.COGNITO_USER_POOL_CLIENT_ID,
      ...options,
    },
  );
}

const jwksResponse = () => ({
  ok: true,
  json: async () => ({
    keys: [
      {
        ...publicKey.export({ format: 'jwk' }),
        kid,
        alg: 'RS256',
        use: 'sig',
      },
    ],
  }),
});

describe(CognitoTokenValidatorService.name, () => {
  const originalFetch = global.fetch;
  let service: CognitoTokenValidatorService;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock = jest.fn().mockResolvedValue(jwksResponse());
    global.fetch = fetchMock as any;
    service = new CognitoTokenValidatorService(config);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('exposes the user pool issuer', () => {
    expect(service.issuer).toBe(issuer);
  });

  it('fetches the JWKS on module init', async () => {
    await service.onModuleInit();

    expect(fetchMock).toHaveBeenCalledWith(`${issuer}/.well-known/jwks.json`);
  });

  it('returns the payload of a valid token', async () => {
    const result: any = await service.validate(makeToken(60));
    expect(result.email).toBe('user@example.com');
  });

  it('accepts a token with a Bearer prefix', async () => {
    const result: any = await service.validate(`Bearer ${makeToken(60)}`);
    expect(result.email).toBe('user@example.com');
  });

  it('caches the JWKS across validations', async () => {
    await service.validate(makeToken(60));
    await service.validate(makeToken(60));

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns undefined without fetching when no token is given', async () => {
    await expect(service.validate()).resolves.toBeUndefined();
    await expect(service.validate('')).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('validates access tokens without requiring an audience', async () => {
    const token = sign(
      { token_use: 'access', client_id: 'client-id', username: 'alice' },
      privateKey,
      { algorithm: 'RS256', keyid: kid, issuer, expiresIn: 60 },
    );

    const result: any = await service.validate(token);

    expect(result.username).toBe('alice');
  });

  it('returns undefined for an access token issued to another client', async () => {
    const token = sign(
      { token_use: 'access', client_id: 'other-client', username: 'alice' },
      privateKey,
      { algorithm: 'RS256', keyid: kid, issuer, expiresIn: 60 },
    );

    await expect(service.validate(token)).resolves.toBeUndefined();
  });

  it('returns undefined for an id token issued to another client', async () => {
    await expect(
      service.validate(makeToken(60, undefined, { audience: 'other-client' })),
    ).resolves.toBeUndefined();
  });

  it('returns undefined for a token from another issuer', async () => {
    await expect(
      service.validate(
        makeToken(60, undefined, { issuer: 'https://evil.example.com' }),
      ),
    ).resolves.toBeUndefined();
  });

  it('returns undefined for a token signed with an unknown kid', async () => {
    await expect(
      service.validate(makeToken(60, undefined, { keyid: 'other-kid' })),
    ).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith(
      'No matching key found for header.kid "other-kid"',
    );
  });

  it('returns undefined for a token without a kid', async () => {
    const token = sign({ token_use: 'id' }, privateKey, {
      algorithm: 'RS256',
    });

    await expect(service.validate(token)).resolves.toBeUndefined();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns undefined when the JWKS cannot be fetched', async () => {
    fetchMock.mockResolvedValue({ ok: false });

    await expect(service.validate(makeToken(60))).resolves.toBeUndefined();
    expect(console.error).toHaveBeenCalledWith('Failed to fetch JWKS');
  });

  it('retries fetching the JWKS after a failed fetch', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false });

    await expect(service.validate(makeToken(60))).resolves.toBeUndefined();
    const result: any = await service.validate(makeToken(60));

    expect(result.email).toBe('user@example.com');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns undefined for an expired token by default', async () => {
    await expect(service.validate(makeToken(-60))).resolves.toBeUndefined();
  });

  it('throws TokenExpiredError for an expired token when throwOnExpired is set', async () => {
    await expect(
      service.validate(makeToken(-60), { throwOnExpired: true }),
    ).rejects.toMatchObject({ name: 'TokenExpiredError' });
  });

  it('returns undefined for an invalid token even when throwOnExpired is set', async () => {
    await expect(
      service.validate('not-a-jwt', { throwOnExpired: true }),
    ).resolves.toBeUndefined();
  });
});
