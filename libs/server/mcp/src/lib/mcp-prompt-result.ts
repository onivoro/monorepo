import type { McpPromptMessage } from './mcp-prompt-message';

export interface McpPromptResult {
  description?: string;
  messages: McpPromptMessage[];
  _meta?: Record<string, unknown>;
}
