import type { Readable, Writable } from 'node:stream';
import type { ServerOptions } from '@modelcontextprotocol/server';
import type { McpServerMetadata } from './mcp-server-metadata';
import type { McpAuthStrategy } from './mcp-auth-strategy';

export interface McpStdioConfig {
  metadata: McpServerMetadata;
  serverOptions?: ServerOptions;
  stdin?: Readable;
  stdout?: Writable;
  /**
   * Send Nest's logs to stderr so they can't corrupt the JSON-RPC stream on stdout.
   * Default: `true` when serving on `process.stdout`, `false` with any other `stdout`.
   * See `McpStderrLogger`.
   */
  redirectLogsToStderr?: boolean;
  /**
   * Optional auth strategy class that runs before guards on every tool execution.
   * Must implement `McpAuthStrategy` and be an `@Injectable()` NestJS service.
   * The module resolves it through DI, so it can inject other services.
   */
  authStrategy?: new (...args: any[]) => McpAuthStrategy;
}
