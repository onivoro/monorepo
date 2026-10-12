import { McpAuthInfo, McpToolContext } from '@onivoro/server-mcp';

/**
 * How an audited call ended.
 *
 * - `success`: the tool returned a result.
 * - `error`: the tool threw, or returned a result with `isError: true`.
 * - `denied`: a guard rejected the call, so the tool never ran.
 * - `rejected`: the auth strategy rejected the caller or the arguments failed validation,
 *   so the tool never ran.
 */
export type McpAuditOutcome = 'success' | 'error' | 'denied' | 'rejected';

/** The tool context as the sink sees it: the bearer token is left out. */
export type McpAuditContext = Omit<McpToolContext, 'authInfo'> & {
  authInfo?: Omit<McpAuthInfo, 'token'>;
};

export interface McpAuditEvent {
  accessEmail: string;
  accessType: string;
  resourceType: string;
  resourceIds: Array<string | number>;
  toolName: string;
  outcome: McpAuditOutcome;
  /** For any outcome but `success`: the error message, or the text of the `isError` result. */
  error?: string;
  context: McpAuditContext;
}

export interface McpAuditSink {
  writeAuditEvent(event: McpAuditEvent): Promise<void> | void;
}
