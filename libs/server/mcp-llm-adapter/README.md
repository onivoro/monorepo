# @onivoro/server-mcp-llm-adapter

Generic adapter for [`@onivoro/server-mcp`](https://www.npmjs.com/package/@onivoro/server-mcp). Converts MCP tool registry entries to any LLM provider's tool definition format and provides a unified execution path. Ships with prebuilt configs for AWS Bedrock Converse, AWS Bedrock Mantle, AWS Bedrock OpenAI-compatible, OpenAI, Anthropic, Google Gemini, and Mistral.

## Install

```bash
npm install @onivoro/server-mcp-llm-adapter
```

### Peer dependencies

| Package | Version |
|---------|---------|
| `@nestjs/common` | `^10.0.0 \|\| ^11.0.0` |

`@onivoro/server-mcp` is a hard dependency — installed automatically.

## Choosing the right config

Configs map to **the API you are calling**, not the model or hosting platform. A model hosted on AWS Bedrock can be called through different APIs, each with its own tool format.

| API you are calling | Config | Module method |
|---------------------|--------|---------------|
| AWS Bedrock **Converse / ConverseStream** | `BEDROCK_CONVERSE_CONFIG` | `forBedrockConverse()` |
| AWS Bedrock **Mantle** (Anthropic Messages format) | `BEDROCK_MANTLE_CONFIG` | `forBedrockMantle()` |
| AWS Bedrock **OpenAI-compatible** | `BEDROCK_OPENAI_CONFIG` | `forBedrockOpenAi()` |
| OpenAI **Chat Completions** (also xAI, Groq, Together) | `OPENAI_CONFIG` | `forOpenAi()` |
| Anthropic **Messages** | `CLAUDE_CONFIG` | `forClaude()` |
| Google **Gemini** | `GEMINI_CONFIG` | `forGemini()` |
| Mistral **La Plateforme** | `MISTRAL_CONFIG` | `forMistral()` |

### Bedrock examples

Bedrock exposes multiple API surfaces. Each has its own tool format — pick the config that matches the API you are calling:

| Scenario | Config |
|----------|--------|
| Any model via Bedrock **Converse / ConverseStream** | `BEDROCK_CONVERSE_CONFIG` |
| Bedrock **Mantle** (Anthropic Messages format) | `BEDROCK_MANTLE_CONFIG` |
| Bedrock **OpenAI-compatible** endpoint | `BEDROCK_OPENAI_CONFIG` |
| Claude on Bedrock via **InvokeModel** | `CLAUDE_CONFIG` |
| Mistral on Bedrock via **InvokeModel** | `MISTRAL_CONFIG` |

Mantle and Converse are mutually exclusive access paths — never mix them. `BEDROCK_MANTLE_CONFIG` uses the Anthropic Messages tool format (`input_schema`) while `BEDROCK_CONVERSE_CONFIG` uses the Converse `toolSpec` envelope. Similarly, `BEDROCK_OPENAI_CONFIG` uses the OpenAI function-calling format independently from `OPENAI_CONFIG` — each has its own alias key for per-provider name overrides.

The same principle applies outside Bedrock — pick the config that matches the API format, not where the model is hosted.

## Usage

Import `McpLlmAdapterModule` alongside whichever MCP module provides the tool registry:

```typescript
import { Module } from '@nestjs/common';
import { McpRegistryModule } from '@onivoro/server-mcp';
import { McpLlmAdapterModule } from '@onivoro/server-mcp-llm-adapter';
import { EmojiToolService } from './services/emoji-tool.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    McpRegistryModule.registerOnly(),
    McpLlmAdapterModule.forBedrockConverse(),
  ],
  providers: [EmojiToolService, ChatService],
})
export class AppModule {}
```

Then inject `McpLlmToolAdapter` wherever you need provider-specific functionality:

```typescript
import { Injectable } from '@nestjs/common';
import { McpLlmToolAdapter } from '@onivoro/server-mcp-llm-adapter';

@Injectable()
export class ChatService {
  constructor(private readonly adapter: McpLlmToolAdapter) {}

  async chat(userMessage: string) {
    // Build provider tool definitions from the registry
    const tools = this.adapter.toProviderTools();

    // ... call the LLM provider with tools ...

    // When the provider returns a tool call:
    const result = await this.adapter.executeToolForProvider(
      toolCall.name,
      toolCall.input,
    );
  }
}
```

## Batch execution

LLM providers can return multiple tool calls in a single turn — OpenAI returns an array of `tool_calls`, Claude returns multiple `tool_use` content blocks, Bedrock returns multiple `toolUse` entries. This is not an MCP spec concept (the MCP protocol's `tools/call` is always a single tool per request), but it's a universal pattern at the LLM API layer that this adapter sits in front of.

`executeToolsForProvider` handles the boilerplate: parallel execution via `Promise.allSettled`, independent per-call error handling (one failure doesn't block siblings), and `id` passthrough for the correlation every provider requires.

```typescript
// LLM returned multiple tool calls in one turn
const results = await this.adapter.executeToolsForProvider(
  toolCalls.map(tc => ({
    providerName: tc.name,
    params: tc.input,
    id: tc.id,  // OpenAI tool_call.id, Claude tool_use.id, Bedrock toolUseId
  })),
  authInfo,
);

// Build tool result messages for the next LLM turn
for (const r of results) {
  messages.push({
    role: 'tool',
    tool_call_id: r.id,
    content: r.success ? r.result : `Error: ${r.error}`,
  });
}
```

Each tool call goes through the full `@onivoro/server-mcp` execution pipeline independently (guards, validation, interceptors, handler) via `registry.executeToolRaw()`. The core MCP library is unchanged — the batch coordination lives entirely in the adapter.

## Output schemas

MCP tools can declare an `outputSchema` for structured result validation. No current LLM provider API supports per-tool output schemas in their tool definition format, so the built-in configs don't forward them. However, the adapter exposes them for consumers that need output schemas at the API call level (e.g., OpenAI `response_format`) or for custom result validation.

```typescript
// Get output schemas for tools that define them
const outputSchemas = this.adapter.getOutputSchemas();
// Map<string, Record<string, unknown>> — provider tool name → JSON Schema

// Use with OpenAI response_format, your own validation, etc.
for (const [toolName, schema] of outputSchemas) {
  console.log(`${toolName} returns:`, schema);
}
```

For custom providers that support per-tool output schemas, use `formatToolWithOutput` in your config:

```typescript
const MY_CONFIG: LlmAdapterConfig<MyToolDef> = {
  aliasKey: 'myProvider',
  formatTool: (name, description, inputSchema) => ({
    name, description, inputSchema,
  }),
  // Called instead of formatTool when the tool has an outputSchema
  formatToolWithOutput: (name, description, inputSchema, outputSchema) => ({
    name, description, inputSchema, outputSchema,
  }),
};
```

When `formatToolWithOutput` is defined and the tool has an `outputSchema`, it is called instead of `formatTool`. Otherwise `formatTool` is used — existing configs are unaffected.

## Custom providers

Use `McpLlmAdapterModule.forProvider()` with a custom config for any provider not included out of the box:

```typescript
import { McpLlmAdapterModule, LlmAdapterConfig } from '@onivoro/server-mcp-llm-adapter';

interface MyToolDef {
  name: string;
  desc: string;
  params: Record<string, unknown>;
}

const MY_CONFIG: LlmAdapterConfig<MyToolDef> = {
  aliasKey: 'myProvider',
  sanitizeName: (name) => name.toUpperCase(),
  formatTool: (name, description, jsonSchema) => ({
    name,
    desc: description,
    params: jsonSchema,
  }),
};

McpLlmAdapterModule.forProvider(MY_CONFIG);
```

## McpLlmToolAdapter API

| Method | Description |
|--------|-------------|
| `toProviderTools()` | Returns `T[]` — tool definitions in the provider's format |
| `getOutputSchemas()` | Returns `Map<string, Record<string, unknown>>` — provider tool names to output JSON Schemas (only tools with `outputSchema`) |
| `resolveProviderToolName(providerName)` | Maps a provider-specific tool name back to the MCP tool name, or `undefined` |
| `executeToolForProvider(providerName, params, authInfo?)` | Resolves name, executes tool, returns stringified result |
| `executeToolCallForProvider(toolCall, authInfo?)` | Executes a single `ProviderToolCall`, returns `ProviderToolCallResult` with id passthrough |
| `executeToolsForProvider(toolCalls, authInfo?)` | Executes multiple tool calls in parallel. Returns `ProviderToolCallResult[]` with per-call success/error |

## Name handling

Each config has an `aliasKey` (e.g., `'bedrock'`, `'bedrock-mantle'`, `'bedrock-openai'`, `'openai'`) used to look up per-provider name overrides from the `@McpTool` decorator's `aliases` parameter.

Resolution order:
1. **Explicit alias** — `aliases[aliasKey]` if present
2. **Sanitized name** — `sanitizeName(mcpName)` if the config defines a sanitizer
3. **MCP name as-is** — used directly when no alias or sanitizer applies

```typescript
// Explicit alias for Bedrock Converse
@McpTool({ name: 'insert-emojis', description: 'Insert emojis', schema, aliases: { bedrock: 'insertEmojis' } })

// No alias needed for OpenAI (hyphens are valid)
@McpTool({ name: 'insert-emojis', description: 'Insert emojis', schema })
```

Providers that require name sanitization (Bedrock Converse, Gemini) apply it automatically — hyphens are replaced with underscores.

## Exports

```typescript
// Module
McpLlmAdapterModule                // NestJS module — forProvider(), forBedrockConverse(), forBedrockMantle(), forBedrockOpenAi(), forOpenAi(), forClaude(), forGemini(), forMistral()

// Adapter
McpLlmToolAdapter                  // Injectable — toProviderTools(), getOutputSchemas(), resolveProviderToolName(), executeToolForProvider(), executeToolCallForProvider(), executeToolsForProvider()
ProviderToolCall                // Input type for single/batch execution — { providerName, params, id? }
ProviderToolCallResult          // Output type for single/batch execution — { providerName, id?, result?, error?, success }

// Config
LlmAdapterConfig                // Interface for custom provider configs
LLM_ADAPTER_CONFIG              // Injection token
resolveProviderName             // Utility: resolves provider name from metadata + config

// Prebuilt configs
BEDROCK_CONVERSE_CONFIG          // AWS Bedrock Converse API
BEDROCK_MANTLE_CONFIG            // AWS Bedrock Mantle (Anthropic Messages format)
BEDROCK_OPENAI_CONFIG            // AWS Bedrock OpenAI-compatible endpoint
OPENAI_CONFIG                    // OpenAI Chat Completions API
CLAUDE_CONFIG                    // Anthropic Messages API
GEMINI_CONFIG                    // Google Gemini API
MISTRAL_CONFIG                   // Mistral La Plateforme API

// Shared formatters (used internally by prebuilt configs, also available for custom configs)
formatAnthropicTool              // Anthropic Messages format — { name, description, input_schema }
formatOpenAiTool                 // OpenAI function format — { type: 'function', function: { name, description, parameters } }

// Types
BedrockConverseToolDefinition    // { toolSpec: { name, description, inputSchema: { json } } }
OpenAiToolDefinition             // { type: 'function', function: { name, description, parameters } }
ClaudeToolDefinition             // { name, description, input_schema }
GeminiToolDefinition             // { name, description, parameters }
```

## Related libraries

| Library | Purpose |
|---------|---------|
| [`@onivoro/server-mcp`](https://www.npmjs.com/package/@onivoro/server-mcp) | Transport-agnostic MCP tool registry, decorators, HTTP and stdio transports |
