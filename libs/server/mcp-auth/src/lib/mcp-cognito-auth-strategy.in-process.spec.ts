import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { McpAuthModule } from './mcp-auth.module';
import type { McpCognitoAuthConfig } from './mcp-cognito-auth-config';
import { McpCognitoAuthStrategy } from './mcp-cognito-auth-strategy';
import type { McpJwksService } from './mcp-jwks.service';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const config: McpCognitoAuthConfig = {
  region: 'us-east-2',
  userPoolId: 'us-east-2_test',
  clientId: 'tooling-client',
  inProcessClientIds: ['web-client'],
  resourceServerUrl: 'https://api.example.com/mcp',
  extraClaims: { username: 'username' },
};
const issuer = `https://cognito-idp.${config.region}.amazonaws.com/${config.userPoolId}`;

function sign(claims: Record<string, unknown>, options?: jwt.SignOptions) {
  return jwt.sign(
    { token_use: 'access', scope: 'openid email', iss: issuer, ...claims },
    privateKey,
    { algorithm: 'RS256', keyid: 'kid', expiresIn: '1h', ...options },
  );
}

function createStrategy(overrides?: Partial<McpCognitoAuthConfig>) {
  return new McpCognitoAuthStrategy({ ...config, ...overrides }, {
    getSigningKey: jest.fn().mockResolvedValue(publicKey),
  } as unknown as McpJwksService);
}

describe('McpCognitoAuthStrategy.verifyInProcessAccessToken', () => {
  it.each(['tooling-client', 'web-client'])(
    'accepts an access token from %s',
    async (clientId) => {
      const authInfo = await createStrategy().verifyInProcessAccessToken(
        sign({ client_id: clientId, username: 'alice' }),
      );

      expect(authInfo.clientId).toBe(clientId);
      expect(authInfo.scopes).toEqual(['openid', 'email']);
      expect(authInfo.extra).toEqual({ username: 'alice' });
    },
  );

  it('keeps the MCP route limited to clientId', async () => {
    const strategy = createStrategy();
    const webToken = sign({ client_id: 'web-client' });

    await expect(strategy.verifyAccessToken(webToken)).rejects.toThrow(
      /unexpected client_id "web-client"/,
    );
    await expect(
      strategy.resolveAuth({ token: webToken, clientId: '', scopes: [] }),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });

  it('accepts only clientId when inProcessClientIds is unset', async () => {
    const strategy = createStrategy({ inProcessClientIds: undefined });

    await expect(
      strategy.verifyInProcessAccessToken(sign({ client_id: 'web-client' })),
    ).rejects.toThrow(/unexpected client_id "web-client"/);
    await expect(
      strategy.verifyInProcessAccessToken(
        sign({ client_id: 'tooling-client' }),
      ),
    ).resolves.toEqual(expect.objectContaining({ clientId: 'tooling-client' }));
  });

  it.each([
    ['another client', sign({ client_id: 'other-client' })],
    ['no client_id', sign({})],
    ['an ID token', sign({ client_id: 'web-client', token_use: 'id' })],
    ['another issuer', sign({ client_id: 'web-client', iss: 'https://evil' })],
    ['an expired token', sign({ client_id: 'web-client' }, { expiresIn: -10 })],
    ['garbage', 'not-a-jwt'],
  ])('rejects %s', async (_label, token) => {
    await expect(
      createStrategy().verifyInProcessAccessToken(token),
    ).rejects.toBeInstanceOf(InvalidTokenError);
  });
});

describe('McpAuthModule.configureCognito inProcessClientIds validation', () => {
  it('rejects empty entries', () => {
    expect(() =>
      McpAuthModule.configureCognito({ ...config, inProcessClientIds: [''] }),
    ).toThrow('inProcessClientIds must not contain empty values');
  });
});
