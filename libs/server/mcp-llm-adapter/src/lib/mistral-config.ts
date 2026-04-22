import type { LlmAdapterConfig } from './llm-adapter-config';
import type { OpenAiToolDefinition } from './open-ai-tool-definition';

export const MISTRAL_CONFIG: LlmAdapterConfig<OpenAiToolDefinition> = {
  aliasKey: 'mistral',
  formatTool: (name, description, jsonSchema) => ({
    type: 'function',
    function: { name, description, parameters: jsonSchema },
  }),
};
