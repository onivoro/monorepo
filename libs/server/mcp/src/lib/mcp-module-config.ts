import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';
import type { EventStore } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { McpServerMetadata } from './mcp-server-metadata';
import type { McpAuthStrategy } from './mcp-auth-strategy';

export interface McpHttpSessionConfig {
  /**
   * Idle session timeout in minutes. Default: 30.
   */
  ttlMinutes?: number;
  /**
   * Custom stateful session ID generator function. Default: `crypto.randomUUID()`.
   */
  idGenerator?: () => string;
  /**
   * EventStore implementation for SSE stream resumability.
   *
   * When provided, the transport stores outgoing events and supports client reconnection
   * via `Last-Event-ID`. Clients that disconnect and reconnect receive replayed events
   * from the point they left off.
   */
  eventStore?: EventStore;
}

export interface McpModuleConfig {
  metadata: McpServerMetadata;
  serverOptions?: ServerOptions;
  /**
   * HTTP route served by McpHttpModule, relative to any Nest global prefix.
   * Defaults to `mcp`, which serves `/mcp` in a standalone app and `/api/mcp`
   * when the host application uses `app.setGlobalPrefix('api')`.
   */
  route?: string;
  /**
   * Optional stateful Streamable HTTP session configuration.
   *
   * When omitted, the HTTP transport is stateless: it does not emit `Mcp-Session-Id`,
   * and any request can be handled by any horizontally scaled instance. This is the
   * default and recommended mode for load-balanced request/response tool servers.
   *
   * Configure this object only when you need stateful MCP sessions for resource
   * subscriptions, server-initiated messages, resumable SSE streams, or per-session
   * server state.
   */
  session?: McpHttpSessionConfig;
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
   * When `true`, the transport returns JSON responses instead of SSE streams.
   * Default: `true` (current behavior). Set to `false` for SSE-only mode.
   */
  enableJsonResponse?: boolean;
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
    /**
     * Protected Resource Metadata URL advertised in the HTTP bearer challenge.
     *
     * Absolute URLs are used as-is. Root-relative paths are resolved against the incoming
     * request origin. When omitted, the transport derives the path-specific RFC 9728 URL
     * from the MCP route being served.
     */
    resourceMetadataUrl?: string;
  };
}
