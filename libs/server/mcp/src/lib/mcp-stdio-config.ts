import type { Readable, Writable } from 'node:stream';
import type { McpServer } from '@modelcontextprotocol/server';
import type { McpServerBaseConfig } from './mcp-server-base-config';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import type { McpProtocolEra } from './mcp-protocol-era';
import type { McpToolVisibilityOptions } from './mcp-tool-visibility';

/**
 * `toolVisibility` and `toolFilter` (from `McpToolVisibilityOptions`) decide which tools the
 * client sees. Stdio carries no token, so the caller's auth is whatever `authStrategy`
 * resolves from `undefined`, decided once per connection.
 */
export interface McpStdioConfig
  extends McpServerBaseConfig,
    McpToolVisibilityOptions {
  /**
   * Which protocol eras the server negotiates.
   *
   * - `'auto'` (default): the client's first message decides: `server/discover` (or any
   *   2026-07-28 request) for the modern protocol, `initialize` for 2025-era clients.
   * - `'legacy'`: 2025-era only. The server is connected to the transport directly, without
   *   the SDK's `serveStdio` era negotiation, so a client probing with `server/discover`
   *   falls back to `initialize`. Use it for clients that need the 2025-era handshake for a
   *   feature: Claude Code doesn't register a channel that negotiates 2026-07-28.
   */
  protocolNegotiation?: 'auto' | 'legacy';
  /**
   * Called with each `McpServer` the module builds, after the registry is wired to it and
   * before it connects: for example to `server.server.setNotificationHandler(...)` for a
   * client notification. With `protocolNegotiation: 'auto'` the SDK may build a server only
   * to answer a `server/discover` probe and then discard it, so this can run more than once.
   *
   * The module sets `server.server.onclose` after this returns. If you set the SDK's
   * single-slot callbacks (`onclose`, `onerror`, `oninitialized`), chain them (call the one
   * that was there) rather than replacing them. If the hook throws, the server is dropped
   * and the error propagates: with `'legacy'` the module fails to start; with `'auto'` the
   * client's request gets an internal error and the module logs the error.
   */
  onServerCreated?: (
    server: McpServer,
    context: { era: McpProtocolEra },
  ) => void;
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
