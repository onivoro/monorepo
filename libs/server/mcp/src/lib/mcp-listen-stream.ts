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
   * (`verifyAccessToken`'s result, as `req.auth` holds it), not resolved by the auth strategy.
   * `undefined` for an unauthenticated request.
   */
  readonly authInfo?: McpAuthInfo;
  /** When the listen request arrived, in milliseconds since the epoch. */
  readonly openedAt: number;
}

/**
 * Decides whether a `subscriptions/listen` stream may open. `false` (or a throw) refuses it:
 * the client gets a JSON-RPC error instead of the stream.
 */
export type McpListenStreamGate = (
  stream: McpListenStream,
) => boolean | Promise<boolean>;
