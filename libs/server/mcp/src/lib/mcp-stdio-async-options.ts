import type { McpStdioConfig } from './mcp-stdio-config';

/**
 * Async factory options for McpStdioModule when configuration
 * needs to be resolved at runtime.
 */
export interface McpStdioAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpStdioConfig | Promise<McpStdioConfig>;
}
