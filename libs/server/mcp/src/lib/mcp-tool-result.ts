import type { McpContentBlock } from './mcp-content-block';

export interface McpToolResult {
  content: McpContentBlock[];
  /** Optional structured output (JSON object) returned alongside content. */
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}
