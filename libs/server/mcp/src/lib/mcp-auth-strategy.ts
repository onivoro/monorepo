import type { McpAuthInfo } from './mcp-auth-info';
import type {
  McpListenStream,
  McpListenStreamRefusal,
} from './mcp-listen-stream';

/**
 * Auth strategy interface that runs before guards on every tool execution.
 * Implement as an `@Injectable()` NestJS service with full DI access.
 *
 * - Return an enriched `McpAuthInfo` to add decoded claims, roles, etc.
 * - Throw to reject the request (e.g., expired token).
 * - Return `undefined` to strip auth (anonymous access).
 */
export interface McpAuthStrategy {
  resolveAuth(
    authInfo: McpAuthInfo | undefined,
  ): McpAuthInfo | undefined | Promise<McpAuthInfo | undefined>;

  /**
   * Optional, HTTP only. Consulted before each 2026-07-28 `subscriptions/listen` stream opens:
   * after the SDK has checked the request (protocol revision, headers, client capabilities)
   * and the stream's filter is well formed, and after the stream is tracked, so a
   * `McpHttpService.closeListenStreams()` call made while this runs (or after) still reaches
   * it. Return `true` to open it, or `false` or `{ reason }` to refuse it: the client gets the
   * JSON-RPC error `MCP_LISTEN_STREAM_REFUSED` with `data.reason` (`'refused'` for `false`).
   * `McpHttpModule` installs it as the service's listen-stream gate
   * (`McpHttpService.setListenStreamGate`).
   *
   * Answer quickly: after `listenStreamGateTimeoutMs` (10 seconds by default) the stream is
   * refused (`'gate_timeout'`). A throw refuses it too (`'gate_failed'`), and is logged.
   *
   * Use it when credentials can be revoked while a stream is open: check here that the
   * caller's session is still live, and close its streams with `closeListenStreams()` when it
   * ends.
   */
  acceptListenStream?(
    stream: McpListenStream,
  ):
    | boolean
    | McpListenStreamRefusal
    | Promise<boolean | McpListenStreamRefusal>;
}
