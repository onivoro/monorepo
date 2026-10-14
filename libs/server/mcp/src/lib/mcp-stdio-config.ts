import type { Readable, Writable } from 'node:stream';
import type {
  McpServer,
  ServerCapabilities,
  ServerOptions,
} from '@modelcontextprotocol/server';
import type { McpServerMetadata } from './mcp-server-metadata';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import type { McpProtocolEra } from './mcp-protocol-era';

export interface McpStdioConfig {
  metadata: McpServerMetadata;
  serverOptions?: ServerOptions;
  /**
   * Capabilities to advertise on top of the ones the module builds from the registry
   * (`buildCapabilities`): for example `experimental: { 'claude/channel': {} }` for a Claude
   * Code channel. Merged one level deep, so `experimental` entries are added and a key both
   * set keeps the module's fields plus yours. Advertise only what the server handles.
   */
  capabilities?: ServerCapabilities;
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
