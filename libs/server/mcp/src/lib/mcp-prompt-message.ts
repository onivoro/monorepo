import type { McpContentBlock } from './mcp-content-block';

export interface McpPromptMessage {
  role: 'user' | 'assistant';
  content: McpContentBlock;
}
