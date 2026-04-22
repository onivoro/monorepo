import type { LlmAdapterConfig } from './llm-adapter-config';
import type { GeminiToolDefinition } from './gemini-tool-definition';

export const GEMINI_CONFIG: LlmAdapterConfig<GeminiToolDefinition> = {
  aliasKey: 'gemini',
  sanitizeName: (name) => name.replace(/[^a-zA-Z0-9_]/g, '_'),
  formatTool: (name, description, jsonSchema) => ({
    name,
    description,
    parameters: jsonSchema,
  }),
};
