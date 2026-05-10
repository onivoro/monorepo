import type { McpModuleConfig } from './mcp-module-config';

export type McpAsyncModuleConfig = Omit<McpModuleConfig, 'route'>;

/**
 * Async factory options for modules that need runtime configuration
 * (e.g., from environment variables, config service, or secret manager).
 */
export interface McpModuleAsyncOptions {
  /**
   * HTTP route served by McpHttpModule, relative to any Nest global prefix.
   *
   * This option is synchronous because Nest controller decorators are created
   * before async factories resolve. Defaults to `mcp`.
   */
  route?: string;
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpAsyncModuleConfig | Promise<McpAsyncModuleConfig>;
}
