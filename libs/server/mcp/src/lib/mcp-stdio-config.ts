import type { Readable, Writable } from 'node:stream';
import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import type { McpServerMetadata } from './mcp-server-metadata';
import type { McpAuthStrategy } from './mcp-auth-strategy';

export interface McpStdioConfig {
  metadata: McpServerMetadata;
  serverOptions?: ServerOptions;
  stdin?: Readable;
  stdout?: Writable;
  /**
   * Optional auth strategy class that runs before guards on every tool execution.
   * Must implement `McpAuthStrategy` and be an `@Injectable()` NestJS service.
   * The module resolves it through DI, so it can inject other services.
   */
  authStrategy?: new (...args: any[]) => McpAuthStrategy;
}
