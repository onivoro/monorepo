import { McpOAuthConfig } from './mcp-oauth-config';

/**
 * Async factory options for `McpOAuthModule.configureAsync()`.
 */
export interface McpOAuthAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpOAuthConfig | Promise<McpOAuthConfig>;
  /**
   * Whether to serve `/.well-known/oauth-protected-resource` (RFC 9728). Default: `true`.
   * Set `false` when `McpAuthModule` from `@onivoro/server-mcp-auth` serves that route.
   * Given here rather than by the factory, because routes are fixed before it runs.
   */
  serveProtectedResourceMetadata?: boolean;
}
