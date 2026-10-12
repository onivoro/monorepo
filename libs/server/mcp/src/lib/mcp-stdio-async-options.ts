import type { McpStdioConfig } from './mcp-stdio-config';

/**
 * Async factory options for McpStdioModule when configuration
 * needs to be resolved at runtime.
 */
export interface McpStdioAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpStdioConfig | Promise<McpStdioConfig>;
  /**
   * Send Nest's logs to stderr so they can't corrupt the JSON-RPC stream on stdout.
   * Decided here rather than in the factory's config, because it has to happen before
   * Nest bootstraps. Default: `true`. See `McpStderrLogger`.
   */
  redirectLogsToStderr?: boolean;
}
