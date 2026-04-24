import type { LlmAdapterConfig } from './llm-adapter-config';
import type { OpenAiToolDefinition } from './open-ai-tool-definition';
import { formatOpenAiTool } from './format-openai-tool';

export const OPENAI_CONFIG: LlmAdapterConfig<OpenAiToolDefinition> = {
  aliasKey: 'openai',
  formatTool: formatOpenAiTool,
};
