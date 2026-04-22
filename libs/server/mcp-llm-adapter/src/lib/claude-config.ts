import type { LlmAdapterConfig } from './llm-adapter-config';
import type { ClaudeToolDefinition } from './claude-tool-definition';

export const CLAUDE_CONFIG: LlmAdapterConfig<ClaudeToolDefinition> = {
  aliasKey: 'claude',
  formatTool: (name, description, jsonSchema) => ({
    name,
    description,
    input_schema: jsonSchema,
  }),
};
