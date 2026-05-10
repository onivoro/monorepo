import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { McpJwksService } from './mcp-jwks.service';
import { McpCognitoAuthStrategy } from './mcp-cognito-auth-strategy';
import type { McpCognitoAuthConfig } from './mcp-cognito-auth-config';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function signToken(claims: Record<string, unknown>, options?: jwt.SignOptions): string {
  return jwt.sign(claims, privateKey, {
    algorithm: 'RS256',
    keyid: 'test-kid-1',
    expiresIn: '1h',
    ...options,
  });
}

describe('McpCognitoAuthStrategy', () => {
  let provider: McpCognitoAuthStrategy;
  let mockJwksService: jest.Mocked<McpJwksService>;

  const baseConfig: McpCognitoAuthConfig = {
    region: 'us-east-2',
    userPoolId: 'us-east-2_EmqDW2Se9',
    clientId: '49jmf4u16r5g3le28hl1fdqp1l',
    resourceServerUrl: 'https://api.example.com/mcp',
  };

  beforeEach(() => {
    mockJwksService = {
      getSigningKey: jest.fn().mockResolvedValue(publicKey),
      onModuleInit: jest.fn(),
    } as any;
  });

  function createProvider(configOverrides?: Partial<McpCognitoAuthConfig>): McpCognitoAuthStrategy {
    return new McpCognitoAuthStrategy({ ...baseConfig, ...configOverrides }, mockJwksService);
  }

  it('accepts valid Cognito access tokens', async () => {
    provider = createProvider();
    const token = signToken({
      token_use: 'access',
      client_id: baseConfig.clientId,
      scope: 'openid email',
      iss: `https://cognito-idp.${baseConfig.region}.amazonaws.com/${baseConfig.userPoolId}`,
      username: 'user-123',
    });

    const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
    expect(result?.clientId).toBe(baseConfig.clientId);
    expect(result?.scopes).toEqual(['openid', 'email']);
  });

  it('rejects Cognito ID tokens', async () => {
    provider = createProvider();
    const token = signToken({
      token_use: 'id',
      client_id: baseConfig.clientId,
      scope: 'openid email',
      iss: `https://cognito-idp.${baseConfig.region}.amazonaws.com/${baseConfig.userPoolId}`,
      aud: baseConfig.clientId,
    });

    await expect(
      provider.verifyAccessToken(token),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('rejects tokens issued for a different client', async () => {
    provider = createProvider();
    const token = signToken({
      token_use: 'access',
      client_id: 'wrong-client-id',
      scope: 'openid email',
      iss: `https://cognito-idp.${baseConfig.region}.amazonaws.com/${baseConfig.userPoolId}`,
    });

    await expect(
      provider.verifyAccessToken(token),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });
});
