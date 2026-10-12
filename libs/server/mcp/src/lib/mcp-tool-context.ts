import type { McpAuthInfo } from './mcp-auth-info';
import type { McpToolMetadata } from './mcp-tool-metadata';
import type { McpLogLevel } from './mcp-log-level';
import type { McpProtocolEra } from './mcp-protocol-era';

/**
 * Context passed to tool handlers and interceptors during execution.
 */
export interface McpToolContext {
  toolName: string;
  params: Record<string, unknown>;
  metadata: McpToolMetadata;
  authInfo?: McpAuthInfo;
  /**
   * The protocol era of the calling client, when called over an MCP transport:
   * `'modern'` (spec 2026-07-28) or `'legacy'` (2025-11-25 and earlier).
   */
  era?: McpProtocolEra;
  /** MCP session identifier from the transport layer. Only 2025-era stateful connections have one. */
  sessionId?: string;
  /** Abort signal — fires when the client cancels the request. */
  signal?: AbortSignal;
  /**
   * Send an incremental progress notification to the client.
   * Only available when the client requested progress tracking via `_meta.progressToken`.
   * No-op when progress is not supported for this request.
   */
  sendProgress?: (
    progress: number,
    total?: number,
    message?: string,
  ) => Promise<void>;
  /**
   * Send a structured log message to the MCP client, on the tool call's response stream.
   * Only available when the transport can deliver it. The client controls the minimum
   * level: with `logging/setLevel` on 2025-era connections, and per request on 2026-07-28
   * ones, where nothing is sent unless the request names a level.
   */
  sendLog?: (
    level: McpLogLevel,
    data: unknown,
    logger?: string,
  ) => Promise<void>;
  /**
   * Answers to the input this tool asked for by returning `inputRequired(...)`, present when
   * the client retries the call with them. Read them with `acceptedContent()` or
   * `inputResponse()`. Works on both eras.
   */
  inputResponses?: Record<string, unknown>;
  /**
   * The `requestState` this tool put in its `inputRequired(...)` result, echoed back by the
   * client. Treat it as untrusted input unless it is signed (`createRequestStateCodec`).
   */
  requestState?: <T = unknown>() => T | undefined;
  /**
   * Request LLM sampling from the client (`sampling/createMessage`).
   * Only on 2025-era connections whose client supports sampling.
   * @deprecated Sampling is deprecated by spec 2026-07-28. Return
   * `inputRequired({ inputRequests: { k: inputRequired.createMessage(...) } })` instead,
   * which reaches clients of both eras.
   */
  createMessage?: (params: Record<string, unknown>) => Promise<unknown>;
  /**
   * Request user input via an elicitation form or URL.
   * Only on 2025-era connections whose client supports elicitation.
   * @deprecated Return `inputRequired({ inputRequests: { k: inputRequired.elicit(...) } })`
   * instead, which reaches clients of both eras.
   */
  elicitInput?: (params: Record<string, unknown>) => Promise<unknown>;
  /**
   * Request the list of filesystem roots from the client.
   * Only on 2025-era connections whose client supports roots.
   * @deprecated Roots are deprecated by spec 2026-07-28. Return
   * `inputRequired({ inputRequests: { k: inputRequired.listRoots() } })` instead.
   */
  listRoots?: () => Promise<unknown>;
}
