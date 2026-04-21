import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import type { EventStore } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export interface McpServerMetadata {
  name: string;
  version: string;
  description?: string;
  /** Human-readable instructions describing how to use the server. Included in the initialize response. */
  instructions?: string;
}

export interface McpModuleConfig {
  metadata: McpServerMetadata;
  serverOptions?: ServerOptions;
  routePrefix?: string;
  sessionTtlMinutes?: number;
  /**
   * Allowed Origin header values for DNS rebinding protection (MCP spec 2025-03-26+).
   *
   * When set, requests with an `Origin` header not in this list are rejected with 403.
   * Requests without an `Origin` header (non-browser MCP clients like Claude Desktop,
   * Claude Code, curl) are always allowed regardless of this setting.
   *
   * When not set, Origin validation is disabled (backward-compatible default).
   *
   * @example ['http://localhost:3000', 'https://my-app.example.com']
   */
  allowedOrigins?: string[];
  /**
   * EventStore implementation for SSE stream resumability.
   *
   * When provided, the transport stores outgoing events and supports client reconnection
   * via `Last-Event-ID`. Clients that disconnect and reconnect receive replayed events
   * from the point they left off.
   *
   * When not set, resumability is disabled (default).
   */
  eventStore?: EventStore;
  /**
   * When `true`, the transport returns JSON responses instead of SSE streams.
   * Default: `true` (current behavior). Set to `false` for SSE-only mode.
   */
  enableJsonResponse?: boolean;
  /**
   * Custom session ID generator function. Default: `crypto.randomUUID()`.
   *
   * Set to `undefined` explicitly to enable stateless mode (no session tracking).
   * When absent from config, the default UUID generator is used.
   */
  sessionIdGenerator?: (() => string) | undefined;
}

/**
 * Async factory options for modules that need runtime configuration
 * (e.g., from environment variables, config service, or secret manager).
 */
export interface McpModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => McpModuleConfig | Promise<McpModuleConfig>;
}
