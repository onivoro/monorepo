import type { McpAuthInfo } from './mcp-auth-info';

/**
 * A 2026-07-28 client's `subscriptions/listen` stream on an HTTP server, open or opening, as
 * `McpHttpService.getListenStreams()` lists it and `closeListenStreams()` and the listen-stream
 * gate see it.
 */
export interface McpListenStream {
  /** The listen request's JSON-RPC id, which is also the subscription's id. */
  readonly subscriptionId: string | number;
  /**
   * The auth the request carried: with `requireBearerAuth`, the verified bearer token's
   * (`verifyAccessToken`'s result), not resolved by the auth strategy. `undefined` for an
   * unauthenticated request.
   *
   * A frozen copy, so changing it can't change the request's auth. It holds the raw bearer
   * token (`token`): never log it, or a stream list, as it is.
   */
  readonly authInfo?: Readonly<McpAuthInfo>;
  /** When the listen request arrived, in milliseconds since the epoch. */
  readonly openedAt: number;
}

/**
 * A gate's refusal with a reason of its own, which the client gets as the error's
 * `data.reason` (say, `'session_ended'`).
 */
export interface McpListenStreamRefusal {
  reason: string;
}

/**
 * Decides whether a `subscriptions/listen` stream may open: `true` opens it; `false` (reason
 * `'refused'`) or an `McpListenStreamRefusal` refuses it. It should answer quickly: it is given
 * `listenStreamGateTimeoutMs` (10 seconds by default), after which the stream is refused
 * (reason `'gate_timeout'`). A throw refuses it too (reason `'gate_failed'`), and is logged.
 */
export type McpListenStreamGate = (
  stream: McpListenStream,
) =>
  | boolean
  | McpListenStreamRefusal
  | Promise<boolean | McpListenStreamRefusal>;

/**
 * The JSON-RPC error code of a refused `subscriptions/listen` request, a server-defined code
 * (in the `-32000` to `-32099` range). The error's `data.reason` says why: the gate's own
 * reason, `'refused'` (the gate said `false`), `'gate_failed'`, `'gate_timeout'`, or
 * `'closed'` (`closeListenStreams()` or shutdown reached it while it was opening).
 */
export const MCP_LISTEN_STREAM_REFUSED = -32003;
