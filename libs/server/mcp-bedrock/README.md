# @onivoro/server-mcp-bedrock

Bedrock adapter for `@onivoro/server-mcp`. Converts MCP tool registry entries to AWS Bedrock tool definitions, handles name sanitization, and provides a Bedrock-specific execution path.

## Install

```bash
npm install @onivoro/server-mcp-bedrock
```

### Peer dependencies

| Package | Version |
|---------|---------|
| `@nestjs/common` | `^10.0.0 \|\| ^11.0.0` |

`@onivoro/server-mcp` is a hard dependency — installed automatically.

## Usage

Import `BedrockMcpModule.forRegistry()` alongside whichever MCP module provides the tool registry:

```typescript
import { Module } from '@nestjs/common';
import { McpRegistryModule } from '@onivoro/server-mcp';
import { BedrockMcpModule } from '@onivoro/server-mcp-bedrock';
import { EmojiToolService } from './services/emoji-tool.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    McpRegistryModule.registerOnly(),
    BedrockMcpModule.forRegistry(),
  ],
  providers: [EmojiToolService, ChatService],
})
export class AppModule {}
```

Then inject `BedrockToolAdapter` wherever you need Bedrock-specific functionality:

```typescript
import { Injectable } from '@nestjs/common';
import { McpToolRegistry } from '@onivoro/server-mcp';
import { BedrockToolAdapter } from '@onivoro/server-mcp-bedrock';

@Injectable()
export class ChatService {
  constructor(
    private readonly registry: McpToolRegistry,
    private readonly bedrockAdapter: BedrockToolAdapter,
  ) {}

  async chat(userMessage: string) {
    // Build Bedrock tool definitions from the registry
    const toolConfig = { tools: this.bedrockAdapter.toBedrockTools() };

    // ... call Bedrock ConverseStream with toolConfig ...

    // When Bedrock returns a tool_use block:
    const mcpName = this.bedrockAdapter.resolveBedrockToolName(toolUse.name);
    const result = await this.registry.executeTool(mcpName, toolUse.input);

    // Format result for Bedrock's toolResult content block
    const resultText = typeof result === 'string' ? result : JSON.stringify(result);
  }
}
```

## BedrockToolAdapter API

| Method | Description |
|--------|-------------|
| `toBedrockTools()` | Returns `BedrockToolDefinition[]` — ready for Bedrock's `toolConfig.tools` |
| `resolveBedrockToolName(bedrockName)` | Maps a Bedrock tool name back to the MCP tool name, or `undefined` |
| `executeToolBedrock(bedrockName, params)` | Resolves name, executes tool, returns stringified result |

## Name sanitization

Bedrock requires tool names matching `^[a-zA-Z][a-zA-Z0-9_]*$` — no hyphens allowed. This library handles it automatically:

- **Auto-sanitization**: `insert-emojis` becomes `insert_emojis` (hyphens replaced with underscores)
- **Explicit alias**: Set `{ bedrock: 'custom_name' }` in the `@McpTool` decorator's `aliases` parameter to override

```typescript
@McpTool('my-tool', 'description', schema, { bedrock: 'myCustomToolName' })
```

## Exports

```typescript
// Module
BedrockMcpModule             // NestJS module — use BedrockMcpModule.forRegistry()

// Adapter
BedrockToolAdapter           // Injectable — toBedrockTools(), resolveBedrockToolName(), executeToolBedrock()

// Utilities
sanitizeToolNameForBedrock   // 'my-tool' → 'my_tool'
resolveBedrockName           // Uses alias if present, else auto-sanitizes
toBedrockToolDefinition      // McpToolMetadata → BedrockToolDefinition

// Types
BedrockToolDefinition        // { toolSpec: { name, description, inputSchema: { json } } }
```

## Related libraries

| Library | Purpose |
|---------|---------|
| [`@onivoro/server-mcp`](../mcp/README.md) | Transport-agnostic MCP tool registry, decorators, HTTP and stdio transports |
