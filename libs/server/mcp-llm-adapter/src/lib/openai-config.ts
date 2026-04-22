import type { LlmAdapterConfig } from './llm-adapter-config';
import type { OpenAiToolDefinition } from './open-ai-tool-definition';

export const OPENAI_CONFIG: LlmAdapterConfig<OpenAiToolDefinition> = {
  aliasKey: 'openai',
  formatTool: (name, description, jsonSchema) => ({
    type: 'function',
    function: { name, description, parameters: jsonSchema },
  }),
};
