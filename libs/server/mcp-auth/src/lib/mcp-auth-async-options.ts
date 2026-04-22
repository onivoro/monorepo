import type { McpAuthConfig } from './mcp-auth-config';

/**
 * Async factory options for `McpAuthModule.registerAsync()`.
 */
export interface McpAuthAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpAuthConfig | Promise<McpAuthConfig>;
}
