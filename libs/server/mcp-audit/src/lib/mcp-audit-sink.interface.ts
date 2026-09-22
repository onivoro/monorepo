import { McpToolContext } from '@onivoro/server-mcp';

export interface McpAuditEvent {
  accessEmail: string;
  accessType: string;
  resourceType: string;
  resourceIds: Array<string | number>;
  toolName: string;
  context: McpToolContext;
}

export interface McpAuditSink {
  writeAuditEvent(event: McpAuditEvent): Promise<void> | void;
}
