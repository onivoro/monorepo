import type { Readable, Writable } from 'node:stream';
import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import type { McpServerMetadata } from './mcp-config.interface';

export interface McpStdioConfig {
  metadata: McpServerMetadata;
  serverOptions?: ServerOptions;
  stdin?: Readable;
  stdout?: Writable;
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
