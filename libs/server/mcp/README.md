# @onivoro/server-mcp

A NestJS library for building transport-agnostic MCP tool services. Define tools once with decorators, consume them over HTTP, stdio, or directly via the registry — with automatic format conversion for MCP, Bedrock, and raw execution.

## Why this library exists

MCP tools are business logic with a protocol wrapper. The problem is that the same tools often need to be consumed in multiple contexts: an MCP HTTP server for Claude Desktop, a stdio process for a VS Code extension calling Bedrock, a direct function call from a test or CLI. Without a shared registry, you end up duplicating tool definitions, schemas, name mappings, and dispatch logic for each transport.

This library solves that by separating **tool definition** (decorators on NestJS services) from **tool consumption** (HTTP sessions, Bedrock tool calls, raw execution). You write your tools once. The registry handles discovery, schema conversion, name mapping, and per-consumer format wrapping automatically.

### What you get

- **Write once, consume anywhere**: `@McpTool` services work over MCP HTTP, stdio/Bedrock, or direct programmatic access without code changes.
- **Automatic format wrapping**: The registry provides per-consumer execution methods. Your service methods return whatever is natural — the registry wraps for the target transport.
- **Schema conversion**: Zod schemas on decorators are converted to JSON Schema automatically. Bedrock tool definitions are generated from the registry with one call.
- **Name mapping**: Bedrock requires `^[a-zA-Z][a-zA-Z0-9_]*$` names. The library auto-sanitizes (`-` to `_`) or uses explicit aliases you declare on the decorator. Reverse lookup (Bedrock name back to MCP name) is built in.
- **Consistent infrastructure**: Sessions, transport, discovery, cleanup, duplicate detection, error handling — all handled.

## Two entry points

| Module | Use case | What it provides |
|--------|----------|------------------|
| `McpModule.configure()` | MCP HTTP server (Claude Desktop, MCP Inspector, web clients) | Full HTTP transport + session management + tool registry |
| `McpRegistryModule.forFeature()` | Non-HTTP consumers (stdio, Bedrock, direct calls) | Tool discovery + registry only, no HTTP overhead |

Both modules auto-discover `@McpTool`, `@McpResource`, and `@McpPrompt` decorated methods from all providers in the NestJS module tree.

## Quick start: MCP HTTP server

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { McpModule } from '@onivoro/server-mcp';
import { EmojiService } from './services/emoji.service';

@Module({
  imports: [
    McpModule.configure({
      metadata: { name: 'my-mcp-server', version: '1.0.0' },
    }),
  ],
  providers: [EmojiService],
})
export class AppModule {}
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { MCP_CORS_ALLOWED_HEADERS, MCP_CORS_EXPOSED_HEADERS } from '@onivoro/server-mcp';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: MCP_CORS_ALLOWED_HEADERS,
    exposedHeaders: MCP_CORS_EXPOSED_HEADERS,
  });
  await app.listen(3000);
}
bootstrap();
```

The MCP endpoint is available at `POST /mcp`. Tools are discovered and registered automatically.

## Quick start: Bedrock via stdio

Use `McpRegistryModule.forFeature()` when you need the tool registry without HTTP transport — for example, in a stdio process that calls AWS Bedrock.

```typescript
// app-stdio.module.ts
import { Module } from '@nestjs/common';
import { McpRegistryModule } from '@onivoro/server-mcp';
import { EmojiService } from './services/emoji.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [McpRegistryModule.forFeature()],
  providers: [EmojiService, ChatService],
})
export class AppStdioModule {}
```

```typescript
// chat.service.ts — using the registry with Bedrock
import { Injectable } from '@nestjs/common';
import { McpToolRegistry } from '@onivoro/server-mcp';

@Injectable()
export class ChatService {
  constructor(private readonly registry: McpToolRegistry) {}

  async chat(userMessage: string) {
    // Generate Bedrock tool definitions from the registry
    const toolConfig = { tools: this.registry.toBedrockTools() };

    // ... call Bedrock with toolConfig ...

    // When Bedrock returns a tool_use block, execute it:
    const result = await this.registry.executeToolBedrock(
      toolUse.name,  // e.g. 'insert_emojis' (Bedrock-sanitized name)
      toolUse.input,
    );
    // result is a string ready for Bedrock's toolResult content block
  }
}
```

The same `EmojiService` with `@McpTool` decorators is used in both examples — no duplication.

## Defining tools

```typescript
import { Injectable } from '@nestjs/common';
import { McpTool } from '@onivoro/server-mcp';
import { z } from 'zod';

@Injectable()
export class EmojiService {
  @McpTool(
    'insert-emojis',
    'Insert emojis into text based on semantic meaning',
    {
      text: z.string().describe('The text to enhance with emojis'),
      intensity: z.enum(['subtle', 'moderate', 'heavy']).optional().describe('Emoji density'),
    },
    { bedrock: 'insert_emojis' },  // explicit Bedrock alias (optional)
  )
  async insertEmojis(params: { text: string; intensity?: string }) {
    const enhanced = this.addEmojis(params.text, params.intensity);
    return { text: enhanced, emojiCount: 5 };
  }

  // ...business logic...
}
```

### Return value handling

Your `@McpTool` methods can return any of these — the registry wraps automatically based on how the tool is consumed:

| Your method returns | `executeTool()` (raw) | `executeToolMcp()` (MCP) | `executeToolBedrock()` (Bedrock) |
|---|---|---|---|
| `{ content: [{ type: 'text', text: '...' }] }` | As-is | Passed through | N/A (use raw) |
| `'plain string'` | `'plain string'` | `{ content: [{ type: 'text', text: 'plain string' }] }` | `'plain string'` |
| `{ key: 'value' }` | `{ key: 'value' }` | `{ content: [{ type: 'text', text: '{"key":"value"}' }] }` | `'{"key":"value"}'` |

This means tool authors never think about transport format. Return whatever is natural for your business logic.

### Aliases

Bedrock requires tool names matching `^[a-zA-Z][a-zA-Z0-9_]*$` — no hyphens. By default, the library auto-sanitizes (`-` to `_`). For cases where auto-sanitization would be lossy or ambiguous, declare an explicit alias:

```typescript
@McpTool('my-tool', 'description', schema, { bedrock: 'my_tool' })
```

The `aliases` parameter is optional. The `openai` alias key is reserved for future use.

## Defining resources

```typescript
@McpResource({
  name: 'config',
  uri: 'app://config',
  description: 'Application configuration',
  mimeType: 'application/json',
})
async getConfig() {
  return {
    contents: [{ uri: 'app://config', text: JSON.stringify(config) }],
  };
}
```

For URI templates, set `isTemplate: true`:

```typescript
@McpResource({
  name: 'item-detail',
  uri: 'item://{id}/detail',
  description: 'Item detail by ID',
  isTemplate: true,
})
async getItemDetail(uri: URL, params: { id: string }) {
  // ...
}
```

## Defining prompts

```typescript
@McpPrompt({
  name: 'summarize',
  description: 'Generate a summary prompt for an item',
  argsSchema: { itemId: z.string().describe('Item ID') },
})
async summarize(params: { itemId: string }) {
  const item = await this.itemService.find(params.itemId);
  return {
    messages: [{
      role: 'user',
      content: { type: 'text', text: `Summarize: ${item.content}` },
    }],
  };
}
```

## McpToolRegistry API

The registry is the core of the library. It is injectable in any NestJS service when either `McpModule.configure()` or `McpRegistryModule.forFeature()` is imported.

### Registration

Called automatically by the module's discovery phase. You don't call these directly unless you're building custom infrastructure.

| Method | Description |
|--------|-------------|
| `registerTool(metadata, handler)` | Register a tool. Throws on duplicate name. |
| `registerResource(metadata, handler)` | Register a resource. Throws on duplicate name. |
| `registerPrompt(metadata, handler)` | Register a prompt. Throws on duplicate name. |

### Introspection

| Method | Returns |
|--------|---------|
| `getTools()` | All registered tools (metadata + handler) |
| `getResources()` | All registered resources |
| `getPrompts()` | All registered prompts |
| `getTool(name)` | Single tool by MCP name, or `undefined` |
| `hasTool(name)` | `true` if a tool with the given MCP name exists |
| `resolveBedrockToolName(bedrockName)` | MCP name for a Bedrock name, or `undefined` |

### Execution

| Method | Input name | Returns | Use when |
|--------|-----------|---------|----------|
| `executeTool(name, params)` | MCP name | Raw handler result | Direct programmatic access, tests |
| `executeToolMcp(name, params)` | MCP name | `McpToolResult` (auto-wrapped) | MCP HTTP transport |
| `executeToolBedrock(bedrockName, params)` | Bedrock name | `string` (stringified) | Bedrock `toolResult` content blocks |

### Schema conversion

| Method | Returns |
|--------|---------|
| `toBedrockTools()` | `BedrockToolDefinition[]` — ready for Bedrock's `toolConfig.tools` |
| `getToolJsonSchemas()` | `Array<{ name, description, jsonSchema }>` — generic JSON Schema |

## Configuration

```typescript
McpModule.configure({
  metadata: {
    name: 'my-server',        // Required. Server name reported to MCP clients.
    version: '1.0.0',         // Required. Server version.
    description: 'Optional',  // Optional. Human-readable description.
  },
  routePrefix: 'api/v1',      // Optional. Prefixes the /mcp route (becomes /api/v1/mcp).
  sessionTtlMinutes: 30,      // Optional. Idle session timeout. Default: 30.
  serverOptions: {},           // Optional. Passed to McpServer from @modelcontextprotocol/sdk.
});
```

## Authentication

Authentication is handled by standard NestJS middleware, not by this library:

```typescript
@Module({
  imports: [McpModule.configure({ ... })],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MyAuthMiddleware).forRoutes('mcp');
  }
}
```

## CORS

The library exports header constants for MCP protocol compliance:

| Export | Headers |
|--------|---------|
| `MCP_CORS_ALLOWED_HEADERS` | `Content-Type`, `Accept`, `Authorization`, `x-api-key`, `Mcp-Session-Id`, `Mcp-Protocol-Version`, `Last-Event-ID` |
| `MCP_CORS_EXPOSED_HEADERS` | `Mcp-Session-Id`, `Mcp-Protocol-Version` |

## Session management (HTTP only)

Each MCP client connection creates a session, identified by the `Mcp-Session-Id` header.

- Sessions are created on the first `POST /mcp` (the `initialize` handshake).
- Sessions are destroyed on `DELETE /mcp` or when the idle TTL expires.
- The default idle TTL is 30 minutes, configurable via `sessionTtlMinutes`.
- All sessions are cleaned up on application shutdown.

## Exports

```typescript
// Modules
McpModule                    // Full HTTP transport — use McpModule.configure()
McpRegistryModule            // Registry only — use McpRegistryModule.forFeature()

// Registry
McpToolRegistry              // Injectable registry — execution, introspection, schema conversion
McpToolResult                // { content: Array<{ type: 'text'; text: string }> }

// Decorators
McpTool                      // Method decorator for tools
McpResource                  // Method decorator for resources
McpPrompt                    // Method decorator for prompts

// Schema converters
mcpSchemaToJsonSchema        // Zod schema → JSON Schema object
sanitizeToolNameForBedrock   // 'my-tool' → 'my_tool'
resolveBedrockName           // Uses alias if present, else auto-sanitizes
toBedrockToolDefinition      // McpToolMetadata → BedrockToolDefinition
BedrockToolDefinition        // { toolSpec: { name, description, inputSchema: { json } } }

// Interfaces
McpModuleConfig              // Configuration for McpModule.configure()
McpServerMetadata            // { name, version, description? }
McpToolMetadata              // { name, description, schema?, aliases? }
McpToolAliases               // { bedrock?, openai? }
McpResourceMetadata          // { name, uri, description?, mimeType?, isTemplate? }
McpPromptMetadata            // { name, description?, argsSchema? }

// Service
McpService                   // HTTP session manager (rarely needed directly)

// Constants
MCP_MODULE_CONFIG            // DI token
MCP_TOOL_METADATA            // Reflect metadata key
MCP_RESOURCE_METADATA        // Reflect metadata key
MCP_PROMPT_METADATA          // Reflect metadata key
MCP_CORS_ALLOWED_HEADERS     // CORS allowed headers array
MCP_CORS_EXPOSED_HEADERS     // CORS exposed headers array
```

## Peer dependencies

```json
{
  "@modelcontextprotocol/sdk": "*",
  "@nestjs/common": "*",
  "@nestjs/core": "*",
  "zod": "*"
}
```
