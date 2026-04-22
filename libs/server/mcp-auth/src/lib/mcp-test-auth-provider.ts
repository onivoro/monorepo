import { Injectable } from '@nestjs/common';
import type { McpAuthProvider, McpAuthInfo } from '@onivoro/server-mcp';

/**
 * Test-friendly auth provider. Use in integration tests to control auth behavior
 * without needing JWKS endpoints or real JWTs.
 *
 * @example
 * ```typescript
 * const module = await Test.createTestingModule({
 *   imports: [
 *     McpHttpModule.registerAndServeHttp({
 *       metadata: { name: 'test', version: '1.0.0' },
 *       authProvider: McpTestAuthProvider,
 *     }),
 *   ],
 * }).compile();
 *
 * const testAuth = module.get(McpTestAuthProvider);
 * testAuth.setAuthInfo(createMockAuthInfo({ scopes: ['admin'] }));
 * ```
 */
@Injectable()
export class McpTestAuthProvider implements McpAuthProvider {
  private authInfo?: McpAuthInfo;
  private shouldThrow?: Error;
  private isConfigured = false;

  /** Set the auth info to return from `resolveAuth`. Pass `undefined` to simulate anonymous/stripped auth. */
  setAuthInfo(authInfo: McpAuthInfo | undefined): void {
    this.authInfo = authInfo;
    this.shouldThrow = undefined;
    this.isConfigured = true;
  }

  /** Configure `resolveAuth` to throw (simulates token rejection). */
  setError(error: Error): void {
    this.shouldThrow = error;
    this.authInfo = undefined;
    this.isConfigured = true;
  }

  /** Reset to passthrough mode (returns the incoming authInfo unchanged). */
  reset(): void {
    this.authInfo = undefined;
    this.shouldThrow = undefined;
    this.isConfigured = false;
  }

  resolveAuth(authInfo: McpAuthInfo | undefined): McpAuthInfo | undefined {
    if (this.shouldThrow) throw this.shouldThrow;
    if (this.isConfigured) return this.authInfo;
    return authInfo;
  }
}

/**
 * Factory for creating `McpAuthInfo` objects in tests.
 */
export function createMockAuthInfo(overrides?: Partial<McpAuthInfo>): McpAuthInfo {
  return {
    token: 'mock-token-' + Math.random().toString(36).slice(2),
    clientId: 'test-client',
    scopes: ['read'],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}

/**
 * Creates a structurally valid but unsigned JWT for unit tests.
 * The token has a proper header.payload.signature structure and is decodable
 * by `jsonwebtoken.decode()`, but the signature is not cryptographically valid.
 *
 * For tests that need signature validation, use a real RSA key pair
 * with `jsonwebtoken.sign()` instead.
 */
export function createMockJwt(claims?: Record<string, unknown>): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-kid' };
  const payload = {
    sub: 'test-subject',
    client_id: 'test-client',
    scope: 'read write',
    iss: 'https://test-issuer.example.com',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...claims,
  };

  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  return `${encode(header)}.${encode(payload)}.mock-signature`;
}
