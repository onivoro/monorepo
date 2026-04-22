import type { LlmAdapterConfig } from './llm-adapter-config';
import type { BedrockConverseToolDefinition } from './bedrock-converse-tool-definition';

export const BEDROCK_CONVERSE_CONFIG: LlmAdapterConfig<BedrockConverseToolDefinition> = {
  aliasKey: 'bedrock',
  sanitizeName: (name) => name.replace(/[^a-zA-Z0-9_]/g, '_'),
  formatTool: (name, description, jsonSchema) => ({
    toolSpec: { name, description, inputSchema: { json: jsonSchema } },
  }),
};
