import type { ClaudeToolDefinition } from './claude-tool-definition';
import type { LlmAdapterConfig } from './llm-adapter-config';

export const formatAnthropicTool: LlmAdapterConfig<ClaudeToolDefinition>['formatTool'] =
  (name, description, jsonSchema) => ({
    name,
    description,
    input_schema: jsonSchema,
  });
