import type { McpResourceContents } from './mcp-resource-contents';

export interface McpResourceResult {
  contents: McpResourceContents[];
  _meta?: Record<string, unknown>;
}
