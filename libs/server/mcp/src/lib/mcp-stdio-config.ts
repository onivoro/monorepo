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
  /**
   * Whether clients see the message of any error a tool throws, or only messages written for
   * them (`McpToolError`s and argument validation failures), with the rest replaced by
   * `Internal error`. Exception messages can leak internal details (hostnames, SQL, stack
   * fragments), so set `false` unless your tools only throw messages meant for clients.
   *
   * Default: `true` in this release, with a startup warning when not set; it becomes `false`
   * in the next major release. Set it explicitly to keep your choice and silence the warning.
   */
  exposeErrorMessages?: boolean;
}
