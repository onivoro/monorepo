import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { McpJwtAuthProvider } from './mcp-jwt-auth-provider';
import { McpJwksService } from './mcp-jwks.service';
import type { McpAuthConfig } from './mcp-auth.config';

// Generate a real RSA key pair for signing test JWTs
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

describe('McpJwtAuthProvider', () => {
  let provider: McpJwtAuthProvider;
  let mockJwksService: jest.Mocked<McpJwksService>;

  const baseConfig: McpAuthConfig = {
    jwksUri: 'https://example.com/.well-known/jwks.json',
    issuer: 'https://example.com',
    audience: 'test-audience',
  };

  beforeEach(() => {
    mockJwksService = {
      getSigningKey: jest.fn().mockResolvedValue(publicKey),
      onModuleInit: jest.fn(),
    } as any;
  });

  function createProvider(configOverrides?: Partial<McpAuthConfig>): McpJwtAuthProvider {
    const config = { ...baseConfig, ...configOverrides };
    return new McpJwtAuthProvider(config, mockJwksService);
  }

  describe('resolveAuth', () => {
    it('should return undefined when authInfo is undefined', async () => {
      provider = createProvider();
      const result = await provider.resolveAuth(undefined);
      expect(result).toBeUndefined();
    });

    it('should return undefined when token is missing', async () => {
      provider = createProvider();
      const result = await provider.resolveAuth({ token: '', clientId: '', scopes: [] });
      expect(result).toBeUndefined();
    });

    it('should validate and enrich a valid JWT', async () => {
      provider = createProvider();
      const token = signToken({
        client_id: 'my-client',
        scope: 'read write',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });

      expect(result).toBeDefined();
      expect(result!.token).toBe(token);
      expect(result!.clientId).toBe('my-client');
      expect(result!.scopes).toEqual(['read', 'write']);
      expect(result!.expiresAt).toBeDefined();
    });

    it('should reject an expired token', async () => {
      provider = createProvider();
      const token = signToken(
        { client_id: 'c', iss: 'https://example.com', aud: 'test-audience' },
        { expiresIn: '-1s' },
      );

      await expect(
        provider.resolveAuth({ token, clientId: '', scopes: [] }),
      ).rejects.toThrow(/expired/i);
    });

    it('should reject a token with wrong issuer', async () => {
      provider = createProvider();
      const token = signToken({
        client_id: 'c',
        iss: 'https://wrong-issuer.com',
        aud: 'test-audience',
      });

      await expect(
        provider.resolveAuth({ token, clientId: '', scopes: [] }),
      ).rejects.toThrow(/issuer/i);
    });

    it('should reject a token with wrong audience', async () => {
      provider = createProvider();
      const token = signToken({
        client_id: 'c',
        iss: 'https://example.com',
        aud: 'wrong-audience',
      });

      await expect(
        provider.resolveAuth({ token, clientId: '', scopes: [] }),
      ).rejects.toThrow(/audience/i);
    });

    it('should reject a token with invalid structure', async () => {
      provider = createProvider();
      await expect(
        provider.resolveAuth({ token: 'not-a-jwt', clientId: '', scopes: [] }),
      ).rejects.toThrow(/Invalid JWT/);
    });

    it('should reject a token with missing kid', async () => {
      provider = createProvider();
      const token = jwt.sign(
        { client_id: 'c', iss: 'https://example.com', aud: 'test-audience' },
        privateKey,
        { algorithm: 'RS256' }, // no keyid
      );

      await expect(
        provider.resolveAuth({ token, clientId: '', scopes: [] }),
      ).rejects.toThrow(/missing kid/);
    });
  });

  describe('clientIdClaim', () => {
    it('should extract clientId from custom claim (Auth0 azp)', async () => {
      provider = createProvider({ clientIdClaim: 'azp' });
      const token = signToken({
        azp: 'auth0-client-id',
        scope: 'read',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.clientId).toBe('auth0-client-id');
    });

    it('should fall back to sub when clientId claim is missing', async () => {
      provider = createProvider();
      const token = signToken({
        sub: 'user-123',
        scope: 'read',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.clientId).toBe('user-123');
    });
  });

  describe('scopeClaim and scopeFormat', () => {
    it('should parse space-delimited scope string (default)', async () => {
      provider = createProvider();
      const token = signToken({
        client_id: 'c',
        scope: 'read write admin',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.scopes).toEqual(['read', 'write', 'admin']);
    });

    it('should parse array scopes (Auth0 permissions)', async () => {
      provider = createProvider({ scopeClaim: 'permissions', scopeFormat: 'array' });
      const token = signToken({
        client_id: 'c',
        permissions: ['read', 'write'],
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.scopes).toEqual(['read', 'write']);
    });

    it('should auto-detect array format', async () => {
      provider = createProvider({ scopeClaim: 'permissions' });
      const token = signToken({
        client_id: 'c',
        permissions: ['admin'],
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.scopes).toEqual(['admin']);
    });

    it('should return empty array when scope claim is missing', async () => {
      provider = createProvider();
      const token = signToken({
        client_id: 'c',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.scopes).toEqual([]);
    });
  });

  describe('extraClaims', () => {
    it('should extract configured extra claims', async () => {
      provider = createProvider({
        extraClaims: { 'custom:tenant': 'tenantId', sub: 'userId' },
      });
      const token = signToken({
        client_id: 'c',
        sub: 'user-abc',
        'custom:tenant': 'tenant-xyz',
        scope: 'read',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.extra).toEqual({ tenantId: 'tenant-xyz', userId: 'user-abc' });
    });

    it('should skip missing extra claims', async () => {
      provider = createProvider({
        extraClaims: { missing_claim: 'value' },
      });
      const token = signToken({
        client_id: 'c',
        scope: 'read',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.extra).toBeUndefined();
    });
  });

  describe('resourceIdentifier', () => {
    it('should set resource when configured', async () => {
      provider = createProvider({ resourceIdentifier: 'https://api.example.com/mcp' });
      const token = signToken({
        client_id: 'c',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result!.resource).toBe('https://api.example.com/mcp');
    });
  });

  describe('verifyAccessToken (OAuthTokenVerifier)', () => {
    it('should return SDK AuthInfo with resource as URL', async () => {
      provider = createProvider({ resourceIdentifier: 'https://api.example.com/mcp' });
      const token = signToken({
        client_id: 'my-client',
        scope: 'read',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.verifyAccessToken(token);

      expect(result.token).toBe(token);
      expect(result.clientId).toBe('my-client');
      expect(result.scopes).toEqual(['read']);
      expect(result.resource).toBeInstanceOf(URL);
      expect(result.resource!.href).toBe('https://api.example.com/mcp');
    });

    it('should return undefined resource when not configured', async () => {
      provider = createProvider();
      const token = signToken({
        client_id: 'c',
        iss: 'https://example.com',
        aud: 'test-audience',
      });

      const result = await provider.verifyAccessToken(token);
      expect(result.resource).toBeUndefined();
    });
  });

  describe('no issuer/audience validation', () => {
    it('should skip issuer/audience checks when not configured', async () => {
      provider = createProvider({ issuer: undefined, audience: undefined });
      const token = signToken({
        client_id: 'c',
        iss: 'any-issuer',
        aud: 'any-audience',
      });

      const result = await provider.resolveAuth({ token, clientId: '', scopes: [] });
      expect(result).toBeDefined();
      expect(result!.clientId).toBe('c');
    });
  });
});
