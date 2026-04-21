import type { LlmAdapterConfig } from './llm-adapter.config';

// -- AWS Bedrock Converse API --

export interface BedrockConverseToolDefinition {
  toolSpec: {
    name: string;
    description: string;
    inputSchema: { json: Record<string, unknown> };
  };
}

export const BEDROCK_CONVERSE_CONFIG: LlmAdapterConfig<BedrockConverseToolDefinition> = {
  aliasKey: 'bedrock',
  sanitizeName: (name) => name.replace(/[^a-zA-Z0-9_]/g, '_'),
  formatTool: (name, description, jsonSchema) => ({
    toolSpec: { name, description, inputSchema: { json: jsonSchema } },
  }),
};

// -- OpenAI Chat Completions API (also compatible with xAI, Groq, Together) --

export interface OpenAiToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export const OPENAI_CONFIG: LlmAdapterConfig<OpenAiToolDefinition> = {
  aliasKey: 'openai',
  formatTool: (name, description, jsonSchema) => ({
    type: 'function',
    function: { name, description, parameters: jsonSchema },
  }),
};

// -- Anthropic Messages API --

export interface ClaudeToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export const CLAUDE_CONFIG: LlmAdapterConfig<ClaudeToolDefinition> = {
  aliasKey: 'claude',
  formatTool: (name, description, jsonSchema) => ({
    name,
    description,
    input_schema: jsonSchema,
  }),
};

// -- Google Gemini API --

export interface GeminiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export const GEMINI_CONFIG: LlmAdapterConfig<GeminiToolDefinition> = {
  aliasKey: 'gemini',
  sanitizeName: (name) => name.replace(/[^a-zA-Z0-9_]/g, '_'),
  formatTool: (name, description, jsonSchema) => ({
    name,
    description,
    parameters: jsonSchema,
  }),
};

// -- Mistral La Plateforme API (OpenAI-compatible format, separate alias key) --

export const MISTRAL_CONFIG: LlmAdapterConfig<OpenAiToolDefinition> = {
  aliasKey: 'mistral',
  formatTool: (name, description, jsonSchema) => ({
    type: 'function',
    function: { name, description, parameters: jsonSchema },
  }),
};
