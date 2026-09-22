import { McpToolContext } from '@onivoro/server-mcp';

export interface McpResolvedAuditEvent {
  accessType: string;
  resourceType: string;
  resourceIds?: Array<string | number | null | undefined>;
}

export interface McpAuditEventResolver {
  resolveAuditEvent(
    context: McpToolContext,
    result: unknown,
  ):
    | Promise<McpResolvedAuditEvent | undefined>
    | McpResolvedAuditEvent
    | undefined;
}
