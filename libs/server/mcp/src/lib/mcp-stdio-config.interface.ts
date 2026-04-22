import type { Readable, Writable } from 'node:stream';
import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import type { McpServerMetadata } from './mcp-config.interface';
import type { McpAuthProvider } from './mcp-tool-registry';

export interface McpStdioConfig {
  metadata: McpServerMetadata;
  serverOptions?: ServerOptions;
  stdin?: Readable;
  stdout?: Writable;
  /**
   * Optional auth provider class that runs before guards on every tool execution.
   * Must implement `McpAuthProvider` and be an `@Injectable()` NestJS service.
   * The module resolves it through DI, so it can inject other services.
   */
  authProvider?: new (...args: any[]) => McpAuthProvider;
}

/**
 * Async factory options for McpStdioModule when configuration
 * needs to be resolved at runtime.
 */
export interface McpStdioAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpStdioConfig | Promise<McpStdioConfig>;
}
