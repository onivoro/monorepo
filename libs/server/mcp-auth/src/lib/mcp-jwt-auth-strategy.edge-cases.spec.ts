import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import { Logger } from '@nestjs/common';
import { InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';
import { McpJwtAuthStrategy } from './mcp-jwt-auth-strategy';
import { McpJwksService } from './mcp-jwks.service';
import type { McpAuthConfig } from './mcp-auth-config';

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

function signToken(
  claims: Record<string, unknown>,
  options?: jwt.SignOptions,
): string {
  return jwt.sign(claims, privateKey, {
    algorithm: 'RS256',
    keyid: 'kid-1',
    expiresIn: '1h',
    ...options,
  });
}

describe('McpJwtAuthStrategy edge cases', () => {
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

  function createStrategy(config?: Partial<McpAuthConfig>) {
    return new McpJwtAuthStrategy(
      { jwksUri: 'https://example.com/.well-known/jwks.json', ...config },
      jwksService,
    );
  }

  async function resolveScopes(
    config: Partial<McpAuthConfig>,
    claims: Record<string, unknown>,
  ) {
    const result = await createStrategy(config).resolveAuth({
      token: signToken(claims),
      clientId: '',
      scopes: [],
    });
    return result?.scopes;
  }

  describe('verifyAccessToken', () => {
    it('rejects an empty token with InvalidTokenError', async () => {
      await expect(createStrategy().verifyAccessToken('')).rejects.toThrow(
        new InvalidTokenError('Invalid access token'),
      );
    });

    it('rejects a token whose signature does not match the JWKS key', async () => {
      const other = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      });
      const token = jwt.sign({ client_id: 'c' }, other.privateKey, {
        algorithm: 'RS256',
        keyid: 'kid-1',
      });

      const error = await createStrategy()
        .verifyAccessToken(token)
        .catch((e) => e);
      expect(error).toBeInstanceOf(InvalidTokenError);
      expect(error.message).toMatch(/invalid signature/);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('JWT validation failed'),
      );
    });

    it('rejects tokens signed with an algorithm that is not allowed', async () => {
      const token = jwt.sign({ client_id: 'c' }, 'shared-secret', {
        algorithm: 'HS256',
        keyid: 'kid-1',
      });

      await expect(
        createStrategy().verifyAccessToken(token),
      ).rejects.toBeInstanceOf(InvalidTokenError);
    });
  });

  describe('JWKS failures', () => {
    it('wraps Error rejections from the JWKS service', async () => {
      jwksService.getSigningKey.mockRejectedValue(new Error('no key'));

      await expect(
        createStrategy().resolveAuth({
          token: signToken({}),
          clientId: '',
          scopes: [],
        }),
      ).rejects.toThrow(new InvalidTokenError('no key'));
    });

    it('uses a generic message for non-Error rejections', async () => {
      jwksService.getSigningKey.mockRejectedValue(42);

      await expect(
        createStrategy().resolveAuth({
          token: signToken({}),
          clientId: '',
          scopes: [],
        }),
      ).rejects.toThrow(new InvalidTokenError('Invalid access token'));
    });
  });

  describe('clientId fallback', () => {
    it('falls back to "unknown" when neither the clientId claim nor sub is present', async () => {
      const result = await createStrategy().resolveAuth({
        token: signToken({}),
        clientId: '',
        scopes: [],
      });

      expect(result?.clientId).toBe('unknown');
      expect(result).not.toHaveProperty('extra');
    });
  });

  describe('scope parsing', () => {
    it('returns [] when scopeFormat is array but the claim is a string', async () => {
      expect(
        await resolveScopes({ scopeFormat: 'array' }, { scope: 'a b' }),
      ).toEqual([]);
    });

    it('returns [] when scopeFormat is string but the claim is an array', async () => {
      expect(
        await resolveScopes({ scopeFormat: 'string' }, { scope: ['a'] }),
      ).toEqual([]);
    });

    it('returns [] in auto mode for unsupported claim types', async () => {
      expect(await resolveScopes({}, { scope: 7 })).toEqual([]);
    });

    it('returns [] when the scope claim is null', async () => {
      expect(await resolveScopes({}, { scope: null })).toEqual([]);
    });

    it('collapses repeated whitespace in string scopes', async () => {
      expect(await resolveScopes({}, { scope: ' read  write ' })).toEqual([
        'read',
        'write',
      ]);
    });

    it('stringifies non-string array entries', async () => {
      expect(
        await resolveScopes({ scopeFormat: 'array' }, { scope: ['a', 1] }),
      ).toEqual(['a', '1']);
    });
  });

  describe('resourceIdentifier', () => {
    const resourceIdentifier = 'https://api.example.com/mcp';

    it('accepts tokens whose audience array includes the resource', async () => {
      const strategy = createStrategy({ resourceIdentifier });
      const token = signToken({ aud: ['other', resourceIdentifier] });

      const result = await strategy.verifyAccessToken(token);
      expect(result.resource).toEqual(new URL(resourceIdentifier));
    });

    it('rejects tokens without an audience claim', async () => {
      const strategy = createStrategy({ resourceIdentifier });

      await expect(strategy.verifyAccessToken(signToken({}))).rejects.toThrow(
        /token audience does not include required resource/,
      );
    });
  });

  describe('algorithms', () => {
    it('honours a custom algorithm allow-list', async () => {
      const strategy = createStrategy({ algorithms: ['RS512'] });

      await expect(
        strategy.verifyAccessToken(signToken({})),
      ).rejects.toBeInstanceOf(InvalidTokenError);

      const rs512 = signToken({ client_id: 'c' }, { algorithm: 'RS512' });
      await expect(strategy.verifyAccessToken(rs512)).resolves.toEqual(
        expect.objectContaining({ clientId: 'c' }),
      );
    });
  });
});
