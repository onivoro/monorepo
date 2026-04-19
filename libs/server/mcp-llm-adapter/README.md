# @onivoro/server-mcp-llm-adapter

Generic adapter for `@onivoro/server-mcp`. Converts MCP tool registry entries to any LLM provider's tool definition format and provides a unified execution path. Ships with prebuilt configs for AWS Bedrock Converse, OpenAI, Anthropic, Google Gemini, and Mistral.

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
| OpenAI **Chat Completions** (also xAI, Groq, Together) | `OPENAI_CONFIG` | `forOpenAi()` |
| Anthropic **Messages** | `CLAUDE_CONFIG` | `forClaude()` |
| Google **Gemini** | `GEMINI_CONFIG` | `forGemini()` |
| Mistral **La Plateforme** | `MISTRAL_CONFIG` | `forMistral()` |

### Bedrock examples

If you use Bedrock's **Converse API**, all models (Claude, Mistral, Llama, etc.) share the same `toolSpec` envelope — use `BEDROCK_CONVERSE_CONFIG`.

If you use Bedrock's **InvokeModel API** (passing the raw request body), the tool format is model-specific:

| Scenario | Config |
|----------|--------|
| Any model via Bedrock **Converse** | `BEDROCK_CONVERSE_CONFIG` |
| Claude on Bedrock via **InvokeModel** | `CLAUDE_CONFIG` |
| Mistral on Bedrock via **InvokeModel** | `MISTRAL_CONFIG` |

The same principle applies outside Bedrock — pick the config that matches the API format, not where the model is hosted.

## Usage

Import `LlmAdapterModule` alongside whichever MCP module provides the tool registry:

```typescript
import { Module } from '@nestjs/common';
import { McpRegistryModule } from '@onivoro/server-mcp';
import { LlmAdapterModule } from '@onivoro/server-mcp-llm-adapter';
import { EmojiToolService } from './services/emoji-tool.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    McpRegistryModule.registerOnly(),
    LlmAdapterModule.forBedrockConverse(),
  ],
  providers: [EmojiToolService, ChatService],
})
export class AppModule {}
```

Then inject `LlmToolAdapter` wherever you need provider-specific functionality:

```typescript
import { Injectable } from '@nestjs/common';
import { LlmToolAdapter } from '@onivoro/server-mcp-llm-adapter';

@Injectable()
export class ChatService {
  constructor(private readonly adapter: LlmToolAdapter) {}

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

## Custom providers

Use `LlmAdapterModule.forProvider()` with a custom config for any provider not included out of the box:

```typescript
import { LlmAdapterModule, LlmAdapterConfig } from '@onivoro/server-mcp-llm-adapter';

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

LlmAdapterModule.forProvider(MY_CONFIG);
```

## LlmToolAdapter API

| Method | Description |
|--------|-------------|
| `toProviderTools()` | Returns `T[]` — tool definitions in the provider's format |
| `resolveProviderToolName(providerName)` | Maps a provider-specific tool name back to the MCP tool name, or `undefined` |
| `executeToolForProvider(providerName, params)` | Resolves name, executes tool, returns stringified result |

## Name handling

Each config has an `aliasKey` (e.g., `'bedrock'`, `'openai'`) used to look up per-provider name overrides from the `@McpTool` decorator's `aliases` parameter.

Resolution order:
1. **Explicit alias** — `aliases[aliasKey]` if present
2. **Sanitized name** — `sanitizeName(mcpName)` if the config defines a sanitizer
3. **MCP name as-is** — used directly when no alias or sanitizer applies

```typescript
// Explicit alias for Bedrock Converse
@McpTool('insert-emojis', 'Insert emojis', schema, { bedrock: 'insertEmojis' })

// No alias needed for OpenAI (hyphens are valid)
@McpTool('insert-emojis', 'Insert emojis', schema)
```

Providers that require name sanitization (Bedrock Converse, Gemini) apply it automatically — hyphens are replaced with underscores.

## Exports

```typescript
// Module
LlmAdapterModule                // NestJS module — forProvider(), forBedrockConverse(), forOpenAi(), forClaude(), forGemini(), forMistral()

// Adapter
LlmToolAdapter                  // Injectable — toProviderTools(), resolveProviderToolName(), executeToolForProvider()

// Config
LlmAdapterConfig                // Interface for custom provider configs
LLM_ADAPTER_CONFIG              // Injection token
resolveProviderName             // Utility: resolves provider name from metadata + config

// Prebuilt configs
BEDROCK_CONVERSE_CONFIG          // AWS Bedrock Converse API
OPENAI_CONFIG                    // OpenAI Chat Completions API
CLAUDE_CONFIG                    // Anthropic Messages API
GEMINI_CONFIG                    // Google Gemini API
MISTRAL_CONFIG                   // Mistral La Plateforme API

// Types
BedrockConverseToolDefinition    // { toolSpec: { name, description, inputSchema: { json } } }
OpenAiToolDefinition             // { type: 'function', function: { name, description, parameters } }
ClaudeToolDefinition             // { name, description, input_schema }
GeminiToolDefinition             // { name, description, parameters }
```

## Related libraries

| Library | Purpose |
|---------|---------|
| [`@onivoro/server-mcp`](../mcp/README.md) | Transport-agnostic MCP tool registry, decorators, HTTP and stdio transports |
