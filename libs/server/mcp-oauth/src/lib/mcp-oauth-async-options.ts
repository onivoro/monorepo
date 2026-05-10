import { McpOAuthConfig } from './mcp-oauth-config';

/**
 * Async factory options for `McpOAuthModule.configureAsync()`.
 */
export interface McpOAuthAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpOAuthConfig | Promise<McpOAuthConfig>;
}
