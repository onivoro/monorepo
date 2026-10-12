import type { McpAuthInfo } from './mcp-auth-info';
import type { McpProtocolEra } from './mcp-protocol-era';

/**
 * Context passed to `@McpResource` and `@McpPrompt` handlers, in place of the MCP SDK's own
 * request context, so handlers don't change shape when the SDK does. The common fields
 * keep the names v1 of the SDK used (`authInfo`, `sessionId`, `signal`).
 */
export interface McpHandlerContext {
  /**
   * The auth info the transport verified (e.g. the bearer token under `requireBearerAuth`).
   * Resource and prompt handlers don't run the tool pipeline, so no auth strategy has
   * resolved it.
   */
  authInfo?: McpAuthInfo;
  /** The protocol era of the calling client: `'modern'` (2026-07-28) or `'legacy'`. */
  era?: McpProtocolEra;
  /** MCP session identifier. Only 2025-era stateful connections have one. */
  sessionId?: string;
  /** Fires when the client cancels the request. */
  signal?: AbortSignal;
  /** Answers to an `inputRequired(...)` result, when the client retries with them. */
  inputResponses?: Record<string, unknown>;
  /** The `requestState` from an `inputRequired(...)` result, echoed back by the client. */
  requestState?: <T = unknown>() => T | undefined;
}
