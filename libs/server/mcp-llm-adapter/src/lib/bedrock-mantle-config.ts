import type { LlmAdapterConfig } from './llm-adapter-config';
import type { ClaudeToolDefinition } from './claude-tool-definition';
import { formatAnthropicTool } from './format-anthropic-tool';

export const BEDROCK_MANTLE_CONFIG: LlmAdapterConfig<ClaudeToolDefinition> = {
  aliasKey: 'bedrock-mantle',
  formatTool: formatAnthropicTool,
};
