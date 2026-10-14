import type { AuthInfo, EventStore } from '@modelcontextprotocol/server';
import type { McpServerBaseConfig } from './mcp-server-base-config';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import type { McpToolVisibilityOptions } from './mcp-tool-visibility';

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
  /**
   * Who owns a session, from the authenticated request that opened it. Later requests for the
   * session must come from the same principal, or they get 404 as if it didn't exist.
   * Only applies when requests are authenticated (`requireBearerAuth`).
   *
   * Default: the token's `clientId` plus `extra.sub` (the JWT subject, which
   * `@onivoro/server-mcp-auth` provides).
   */
  principal?: (authInfo: AuthInfo) => string | undefined;
}

/**
 * `toolVisibility` and `toolFilter` (from `McpToolVisibilityOptions`) decide which tools each
 * caller sees. Over HTTP the caller's auth is the request's verified bearer token
 * (`requireBearerAuth`), resolved by `authStrategy`: per request for 2026-07-28 clients and
 * stateless 2025-era POSTs; for a stateful session, from the request that opens it, and
 * again whenever a later request on it carries a different token or scope set.
 */
export interface McpModuleConfig
  extends McpServerBaseConfig,
    McpToolVisibilityOptions {
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
   * Allowed `Origin` header values, for DNS rebinding protection (the spec requires servers
   * to validate `Origin`). Requests whose `Origin` is not listed get 403. `'*'` allows any.
   *
   * When not set, a request with an `Origin` header is only allowed from the server's own
   * origin: the origin's host (and port) must match the request's (`X-Forwarded-Host`, else
   * `Host`).
   * Requests without an `Origin` header (non-browser MCP clients like Claude Desktop,
   * Claude Code, curl) are always allowed.
   *
   * @example ['http://localhost:3000', 'https://my-app.example.com']
   */
  allowedOrigins?: string[];
  /**
   * Allowed `Host` header values (`host` or `host:port`, as clients send them). Requests for
   * any other host get 403.
   *
   * When not set, a request that arrives on a loopback address (`127.0.0.1`, `::1`) without
   * proxy headers must name `localhost`, `127.0.0.1` or `[::1]` as its host, which stops a
   * DNS-rebound web page from reaching a local server. Other requests aren't checked.
   */
  allowedHosts?: string[];
  /**
   * When `true`, the transport answers each POST with a single JSON response.
   * Default: `false`, which answers with an SSE stream.
   *
   * JSON responses can't carry anything sent while a tool runs, so with `true` the server
   * doesn't advertise `logging`, and tool handlers get no `sendProgress`, `sendLog`,
   * `createMessage`, `elicitInput` or `listRoots`.
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
   * Whether clients see the message of any error a tool throws, or only messages written for
   * them (`McpToolError`s and argument validation failures), with the rest replaced by
   * `Internal error`. Exception messages can leak internal details (hostnames, SQL, stack
   * fragments), so set `false` unless your tools only throw messages meant for clients.
   *
   * Default: `true` in this release, with a startup warning when not set; it becomes `false`
   * in the next major release. Set it explicitly to keep your choice and silence the warning.
   */
  exposeErrorMessages?: boolean;

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
  requireBearerAuth?:
    | boolean
    | {
        requiredScopes?: string[];
        /**
         * Protected Resource Metadata URL advertised in the HTTP bearer challenge.
         *
         * Absolute URLs are used as-is. Root-relative paths are resolved against the incoming
         * request origin. When omitted, the transport derives the path-specific RFC 9728 URL
         * from the MCP route being served.
         */
        resourceMetadataUrl?: string;
        /**
         * The canonical URL of this MCP server. When set, tokens whose `resource` doesn't match
         * are rejected with 401, on top of whatever audience check the verifier does.
         */
        expectedResource?: string;
      };
}
