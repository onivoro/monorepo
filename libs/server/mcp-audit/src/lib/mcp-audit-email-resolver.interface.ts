import { McpToolContext } from '@onivoro/server-mcp';

export interface McpAuditEmailResolver {
  resolveEmail(
    context: McpToolContext,
  ): Promise<string | undefined> | string | undefined;
}
