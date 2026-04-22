import type { McpAuthInfo } from './mcp-auth-info';
import type { McpToolMetadata } from './mcp-tool-metadata';
import type { McpLogLevel } from './mcp-log-level';

/**
 * Context passed to tool handlers and interceptors during execution.
 */
export interface McpToolContext {
  toolName: string;
  params: Record<string, unknown>;
  metadata: McpToolMetadata;
  authInfo?: McpAuthInfo;
  /** MCP session identifier from the transport layer. */
  sessionId?: string;
  /** Abort signal — fires when the client cancels the request. */
  signal?: AbortSignal;
  /**
   * Send an incremental progress notification to the client.
   * Only available when the client requested progress tracking via `_meta.progressToken`.
   * No-op when progress is not supported for this request.
   */
  sendProgress?: (progress: number, total?: number, message?: string) => Promise<void>;
  /**
   * Send a structured log message to the MCP client.
   * Only available when the server is connected via a transport (HTTP/stdio).
   * The client controls the minimum log level via `logging/setLevel`.
   */
  sendLog?: (level: McpLogLevel, data: unknown, logger?: string) => Promise<void>;
  /**
   * Request LLM sampling from the client. Only available when the client supports sampling.
   * Sends a `sampling/createMessage` request to the client.
   */
  createMessage?: (params: Record<string, unknown>) => Promise<unknown>;
  /**
   * Request user input via an elicitation form or URL.
   * Only available when the client supports elicitation.
   */
  elicitInput?: (params: Record<string, unknown>) => Promise<unknown>;
  /**
   * Request the list of filesystem roots from the client.
   * Only available when the client supports roots.
   */
  listRoots?: () => Promise<unknown>;
}
