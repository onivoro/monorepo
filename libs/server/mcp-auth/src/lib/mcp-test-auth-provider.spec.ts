import * as jwt from 'jsonwebtoken';
import { McpTestAuthProvider, createMockAuthInfo, createMockJwt } from './mcp-test-auth-provider';

describe('McpTestAuthProvider', () => {
  let provider: McpTestAuthProvider;

  beforeEach(() => {
    provider = new McpTestAuthProvider();
  });

  it('should pass through authInfo by default', () => {
    const authInfo = createMockAuthInfo();
    expect(provider.resolveAuth(authInfo)).toBe(authInfo);
  });

  it('should return configured authInfo when set', () => {
    const custom = createMockAuthInfo({ clientId: 'custom', scopes: ['admin'] });
    provider.setAuthInfo(custom);

    expect(provider.resolveAuth(undefined)).toBe(custom);
  });

  it('should throw when error is set', () => {
    provider.setError(new Error('unauthorized'));
    expect(() => provider.resolveAuth(undefined)).toThrow('unauthorized');
  });

  it('should reset to passthrough mode', () => {
    provider.setAuthInfo(createMockAuthInfo({ clientId: 'custom' }));
    provider.reset();

    const authInfo = createMockAuthInfo();
    expect(provider.resolveAuth(authInfo)).toBe(authInfo);
  });

  it('should return undefined from resolveAuth when setAuthInfo(undefined)', () => {
    provider.setAuthInfo(undefined);
    expect(provider.resolveAuth(createMockAuthInfo())).toBeUndefined();
  });
});

describe('createMockAuthInfo', () => {
  it('should return valid McpAuthInfo with defaults', () => {
    const info = createMockAuthInfo();
    expect(info.token).toBeDefined();
    expect(info.clientId).toBe('test-client');
    expect(info.scopes).toEqual(['read']);
    expect(info.expiresAt).toBeGreaterThan(Math.floor(Date.now() / 1000));
  });

  it('should apply overrides', () => {
    const info = createMockAuthInfo({
      clientId: 'my-client',
      scopes: ['admin'],
      extra: { tenantId: 't-1' },
    });

    expect(info.clientId).toBe('my-client');
    expect(info.scopes).toEqual(['admin']);
    expect(info.extra).toEqual({ tenantId: 't-1' });
  });

  it('should generate unique tokens', () => {
    const a = createMockAuthInfo();
    const b = createMockAuthInfo();
    expect(a.token).not.toBe(b.token);
  });
});

describe('createMockJwt', () => {
  it('should return a decodable JWT', () => {
    const token = createMockJwt();
    const decoded = jwt.decode(token, { complete: true });

    expect(decoded).toBeDefined();
    expect(decoded!.header.alg).toBe('RS256');
    expect(decoded!.header.kid).toBe('test-kid');
    expect((decoded!.payload as any).client_id).toBe('test-client');
    expect((decoded!.payload as any).scope).toBe('read write');
  });

  it('should accept custom claims', () => {
    const token = createMockJwt({ sub: 'custom-sub', 'custom:field': 'value' });
    const decoded = jwt.decode(token, { complete: true });

    expect((decoded!.payload as any).sub).toBe('custom-sub');
    expect((decoded!.payload as any)['custom:field']).toBe('value');
  });

  it('should have three dot-separated parts', () => {
    const token = createMockJwt();
    expect(token.split('.')).toHaveLength(3);
  });
});
