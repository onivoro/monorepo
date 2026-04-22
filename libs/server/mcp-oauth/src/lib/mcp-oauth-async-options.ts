import { McpOAuthConfig } from './mcp-oauth-config';

/**
 * Async factory options for `McpOAuthModule.registerAsync()`.
 */
export interface McpOAuthAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpOAuthConfig | Promise<McpOAuthConfig>;
}
