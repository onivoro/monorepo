import type { McpModuleConfig } from './mcp-module-config';

/**
 * Async factory options for modules that need runtime configuration
 * (e.g., from environment variables, config service, or secret manager).
 */
export interface McpModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpModuleConfig | Promise<McpModuleConfig>;
}
