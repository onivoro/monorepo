import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import type { EventStore } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServerMetadata } from './mcp-server-metadata';
import type { McpAuthStrategy } from './mcp-auth-strategy';

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
  /**
   * Optional auth strategy class that runs before guards on every tool execution.
   * Must implement `McpAuthStrategy` and be an `@Injectable()` NestJS service.
   * The module resolves it through DI, so it can inject other services
   * (e.g., `JwtService`, `ConfigService`, repositories).
   */
  authStrategy?: new (...args: any[]) => McpAuthStrategy;

  /**
   * Enforce HTTP Bearer authentication at the transport layer before MCP request handling.
   *
   * When enabled and the configured `authStrategy` implements the MCP SDK's
   * `OAuthTokenVerifier` interface, unauthenticated requests receive an HTTP 401
   * challenge with `WWW-Authenticate` metadata so MCP clients can initiate OAuth.
   *
   * This is stronger than relying on `authStrategy.resolveAuth()` alone, which runs
   * during tool execution and cannot trigger the client's HTTP auth flow.
   *
   * `true` uses default behavior with no required scopes. Pass an object to require
   * specific scopes in the HTTP auth challenge.
   */
  requireBearerAuth?: boolean | {
    requiredScopes?: string[];
  };
}
