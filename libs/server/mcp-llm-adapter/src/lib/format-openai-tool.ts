import type { OpenAiToolDefinition } from './open-ai-tool-definition';
import type { LlmAdapterConfig } from './llm-adapter-config';

export const formatOpenAiTool: LlmAdapterConfig<OpenAiToolDefinition>['formatTool'] =
  (name, description, jsonSchema) => ({
    type: 'function',
    function: { name, description, parameters: jsonSchema },
  });
