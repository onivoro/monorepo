import { Injectable } from '@nestjs/common';
import type { McpAuthStrategy, McpAuthInfo } from '@onivoro/server-mcp';
import { createMockAuthInfo } from './create-mock-auth-info';

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
 *       authStrategy: McpTestAuthStrategy,
 *     }),
 *   ],
 * }).compile();
 *
 * const testAuth = module.get(McpTestAuthStrategy);
 * testAuth.setAuthInfo(createMockAuthInfo({ scopes: ['admin'] }));
 * ```
 */
@Injectable()
export class McpTestAuthStrategy implements McpAuthStrategy {
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
