import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Logger } from '@nestjs/common';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { McpJwksService } from './mcp-jwks.service';
import {
  buildJwtConfig,
  McpCognitoAuthStrategy,
} from './mcp-cognito-auth-strategy';
import type { McpCognitoAuthConfig } from './mcp-cognito-auth-config';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const baseConfig: McpCognitoAuthConfig = {
  region: 'us-east-2',
  userPoolId: 'us-east-2_Pool',
  clientId: 'client-abc',
  resourceServerUrl: 'https://api.example.com/mcp',
};

const issuer = `https://cognito-idp.${baseConfig.region}.amazonaws.com/${baseConfig.userPoolId}`;

function signToken(claims: Record<string, unknown>): string {
  return jwt.sign(claims, privateKey, {
    algorithm: 'RS256',
    keyid: 'kid-1',
    expiresIn: '1h',
  });
}

describe('McpCognitoAuthStrategy edge cases', () => {
  let jwksService: jest.Mocked<McpJwksService>;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    jwksService = {
      getSigningKey: jest.fn().mockResolvedValue(publicKey),
      onModuleInit: jest.fn(),
    } as any;
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => warnSpy.mockRestore());

  function createStrategy(overrides?: Partial<McpCognitoAuthConfig>) {
    return new McpCognitoAuthStrategy(
      { ...baseConfig, ...overrides },
      jwksService,
    );
  }

  it('returns undefined from resolveAuth when there is no token', async () => {
    const strategy = createStrategy();
    await expect(strategy.resolveAuth(undefined)).resolves.toBeUndefined();
    await expect(
      strategy.resolveAuth({ token: '', clientId: '', scopes: [] }),
    ).resolves.toBeUndefined();
  });

  it('verifyAccessToken returns SDK AuthInfo for a valid access token', async () => {
    const strategy = createStrategy({ extraClaims: { username: 'username' } });
    const token = signToken({
      token_use: 'access',
      client_id: baseConfig.clientId,
      scope: 'openid profile',
      iss: issuer,
      username: 'alice',
    });

    const result = await strategy.verifyAccessToken(token);

    expect(result).toEqual(
      expect.objectContaining({
        token,
        clientId: baseConfig.clientId,
        scopes: ['openid', 'profile'],
        extra: { username: 'alice' },
      }),
    );
    expect(typeof result.expiresAt).toBe('number');
    expect(jwksService.getSigningKey).toHaveBeenCalledWith('kid-1');
  });

  it('rejects tokens with a missing client_id claim and names it in the error', async () => {
    const strategy = createStrategy();
    const token = signToken({ token_use: 'access', sub: 'user', iss: issuer });

    await expect(
      strategy.resolveAuth({ token, clientId: '', scopes: [] }),
    ).rejects.toThrow('Invalid JWT: unexpected client_id "missing"');
  });

  it('rejects tokens whose client_id is not a string', async () => {
    const strategy = createStrategy();
    const token = signToken({
      token_use: 'access',
      client_id: 123,
      iss: issuer,
    });

    await expect(strategy.verifyAccessToken(token)).rejects.toThrow(
      /unexpected client_id "missing"/,
    );
  });

  it('rejects ID tokens via resolveAuth', async () => {
    const strategy = createStrategy();
    const token = signToken({
      token_use: 'id',
      client_id: baseConfig.clientId,
      iss: issuer,
    });

    await expect(
      strategy.resolveAuth({ token, clientId: '', scopes: [] }),
    ).rejects.toThrow('Invalid JWT: expected a Cognito access token');
  });

  it('rejects tokens from a different user pool issuer', async () => {
    const strategy = createStrategy();
    const token = signToken({
      token_use: 'access',
      client_id: baseConfig.clientId,
      iss: 'https://cognito-idp.us-east-2.amazonaws.com/other-pool',
    });

    await expect(strategy.verifyAccessToken(token)).rejects.toBeInstanceOf(
      InvalidTokenError,
    );
  });

  it('wraps unexpected Error failures (e.g. JWKS lookup) in InvalidTokenError and logs them', async () => {
    jwksService.getSigningKey.mockRejectedValue(new Error('jwks unavailable'));
    const strategy = createStrategy();
    const token = signToken({
      token_use: 'access',
      client_id: baseConfig.clientId,
      iss: issuer,
    });

    const error = await strategy
      .resolveAuth({ token, clientId: '', scopes: [] })
      .catch((e) => e);

    expect(error).toBeInstanceOf(InvalidTokenError);
    expect(error.message).toBe('jwks unavailable');
    expect(warnSpy).toHaveBeenCalledWith(
      'Cognito MCP token validation failed: jwks unavailable',
    );
  });

  it('uses a generic message when a non-Error value is thrown', async () => {
    jwksService.getSigningKey.mockRejectedValue('nope');
    const strategy = createStrategy();
    const token = signToken({
      token_use: 'access',
      client_id: baseConfig.clientId,
      iss: issuer,
    });

    await expect(strategy.verifyAccessToken(token)).rejects.toThrow(
      'Invalid access token',
    );
  });
});

describe('buildJwtConfig', () => {
  it('derives the Cognito issuer, JWKS URI and claim settings', () => {
    expect(buildJwtConfig(baseConfig)).toEqual(
      expect.objectContaining({
        issuer,
        jwksUri: `${issuer}/.well-known/jwks.json`,
        clientIdClaim: 'client_id',
        scopeClaim: 'scope',
        scopeFormat: 'string',
        resourceServerUrl: baseConfig.resourceServerUrl,
      }),
    );
  });

  it('passes through optional metadata and JWKS settings', () => {
    const config = buildJwtConfig({
      ...baseConfig,
      extraClaims: { email: 'email' },
      authorizationServers: ['https://auth.example.com'],
      serveProtectedResourceMetadata: false,
      protectedResourceMetadataMode: 'root',
      resourceName: 'My API',
      resourceDocumentationUrl: 'https://docs.example.com',
      jwksCache: false,
      jwksCacheMaxAge: 1000,
      jwksRateLimit: false,
      jwksRequestsPerMinute: 3,
    });

    expect(config).toEqual(
      expect.objectContaining({
        extraClaims: { email: 'email' },
        authorizationServers: ['https://auth.example.com'],
        serveProtectedResourceMetadata: false,
        protectedResourceMetadataMode: 'root',
        resourceName: 'My API',
        resourceDocumentationUrl: 'https://docs.example.com',
        jwksCache: false,
        jwksCacheMaxAge: 1000,
        jwksRateLimit: false,
        jwksRequestsPerMinute: 3,
      }),
    );
    expect(config).not.toHaveProperty('audience');
  });
});
