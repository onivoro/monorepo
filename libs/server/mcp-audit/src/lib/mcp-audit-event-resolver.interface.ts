import { McpToolContext } from '@onivoro/server-mcp';
import type { McpAuditOutcome } from './mcp-audit-sink.interface';

export interface McpResolvedAuditEvent {
  accessType: string;
  resourceType: string;
  resourceIds?: Array<string | number | null | undefined>;
}

export interface McpAuditEventResolver {
  /**
   * @param result What the tool returned; `undefined` when it threw or never ran.
   * @param outcome How the call ended. For `denied` and `rejected` calls, `context.params`
   *   holds the arguments as received, not validated.
   */
  resolveAuditEvent(
    context: McpToolContext,
    result: unknown,
    outcome: McpAuditOutcome,
  ):
    | Promise<McpResolvedAuditEvent | undefined>
    | McpResolvedAuditEvent
    | undefined;
}
