# @onivoro/server-mcp

A NestJS library for building transport-agnostic MCP tool services. Define tools once with decorators, consume them over HTTP, stdio, or directly via the registry. The documentation and examples generally focus one enterprise monorepos but can be easily adapted to single apps.

## Why this library exists

MCP tools are business logic with a protocol wrapper. The problem is that the same tools often need to be consumed in multiple contexts: an MCP HTTP server for Claude Desktop, a stdio process for a VS Code extension, a direct function call from a test or CLI. Without a shared registry, you end up duplicating tool definitions, schemas, and dispatch logic for each transport.

This library solves that by separating **tool definition** (decorators on NestJS services) from **tool consumption** (HTTP sessions, stdio, raw execution). You write your tools once. The registry handles discovery, schema conversion, and per-consumer format wrapping automatically.

Consumer-specific formatting (e.g. Bedrock Converse tool definitions, OpenAI function calling, Anthropic Messages API) lives in a separate adapter library that layers on top of the registry. See [`@onivoro/server-mcp-llm-adapter`](../mcp-llm-adapter/README.md) for the generic LLM adapter.

### Design goals

- **Consistency**: Teams working across an enterprise monorepo — or across separate repos entirely — get the same decorator API, the same registry behavior, and the same module patterns. A tool defined in one repo looks and works identically to a tool defined in another.
- **Flexibility**: The library bolts onto existing NestJS services just as easily as it structures dedicated MCP libraries. Import a module, add a decorator, and an existing service gains MCP capabilities without restructuring.
- **DRYness**: Tool definitions, schemas, and execution logic are defined once and consumed everywhere. Schemas live in a single source of truth (a Zod object in the business logic layer), and *optionally defined* shared MCP adapter libraries (`libs/mcp/{domain}`) let multiple apps serve the same tools without duplication. The tool manifest is composed dynamically from decorated methods at startup — there is no separate manifest file to maintain or keep in sync.
- **Modularity**: Each concern — transport, registry, consumer-specific formatting — is a separate module. You compose only what you need. An app that talks to Bedrock directly never imports HTTP session management; an MCP HTTP server never imports Bedrock name sanitization. The decorator approach and auto-discovery also allows a single (or multiple) MCP servers to be composed from reusable business logic libraries or resusable dedicated MCP libraries.

### What you get

- **Write once, consume anywhere**: `@McpTool` services work over MCP HTTP, MCP stdio, or direct programmatic access without code changes.
- **Type-safe schemas**: `@McpTool` accepts `z.ZodObject`, enabling `z.infer<typeof schema>` for compile-time type safety on tool parameters.
- **Automatic format wrapping**: The registry provides per-consumer execution methods. Your service methods return whatever is natural — the registry wraps for the target transport.
- **Schema conversion**: Zod schemas on decorators are converted to JSON Schema automatically via zod v4's native `z.toJSONSchema()`.
- **Consistent infrastructure**: Sessions, transport, discovery, cleanup, duplicate detection, error handling — all handled.

## Three entry points

| Module | Transport | Use case |
|--------|-----------|----------|
| `McpHttpModule.registerAndServeHttp()` | Streamable HTTP | MCP clients over network (Claude Desktop remote, MCP Inspector, web clients) |
| `McpStdioModule.registerAndServeStdio()` | Stdio (stdin/stdout) | MCP clients via subprocess (Claude Desktop local, `npx`-style servers) |
| `McpRegistryModule.registerOnly()` | None | In-process consumption (Bedrock via adapter, direct calls, tests) |

All three modules auto-discover `@McpTool`, `@McpResource`, and `@McpPrompt` decorated methods from all providers in the NestJS module tree.

## Client compatibility

This library supports **stdio** and **Streamable HTTP** (MCP spec 2025-03-26). It does **not** support the legacy SSE transport (`GET /sse` + `POST /messages`) by design. Consumers that don't fully support the standard right now (see table below) will eventually catch up.

| Client | stdio | Streamable HTTP | Status |
|--------|:-----:|:---------------:|--------|
| Claude Desktop | Y | Y | Full support |
| Claude Code (CLI) | Y | Y | Full support |
| Cursor | Y | Y | Full support |
| Windsurf (Codeium) | Y | Y | Full support |
| VS Code Copilot | Y | Y | Full support (GA since VS Code 1.102) |
| Continue.dev | Y | Y | Full support |
| JetBrains AI Assistant | Y | Y | Full support (2025.2+) |
| Roo Code | Y | Y | Full support (v3.19.2+) |
| MCP Inspector | Y | Y | Full support |
| Zed | Y | - | stdio only — use `mcp-remote` to bridge to HTTP servers |
| Amazon Q Developer | Y | ~ | stdio works; Streamable HTTP has known bugs |
| Cline | Y | ~ | stdio works; Streamable HTTP nominally supported but buggy |

**Y** = supported, **~** = partial/buggy, **-** = not supported

Clients marked as partial or unsupported over HTTP can still connect via stdio (`McpStdioModule`). For Zed specifically, the community `mcp-remote` package acts as a local stdio-to-HTTP bridge.

## Quick start: MCP HTTP server

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { McpHttpModule } from '@onivoro/server-mcp';
import { EmojiService } from './services/emoji.service';

@Module({
  imports: [
    McpHttpModule.registerAndServeHttp({
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
import { MCP_CORS_CONFIG } from '@onivoro/server-mcp';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors(MCP_CORS_CONFIG);
  await app.listen(3000);
}
bootstrap();
```

The MCP endpoint is available at `POST /mcp`. Tools are discovered and registered automatically.

## Quick start: MCP stdio server

Use `McpStdioModule.registerAndServeStdio()` when your MCP server runs as a subprocess — the standard model for Claude Desktop local servers, `npx`-invoked MCP tools, and similar environments where the client spawns your process and communicates over stdin/stdout.

```typescript
// app-stdio.module.ts
import { Module } from '@nestjs/common';
import { McpStdioModule } from '@onivoro/server-mcp';
import { EmojiService } from './services/emoji.service';

@Module({
  imports: [
    McpStdioModule.registerAndServeStdio({
      metadata: { name: 'my-stdio-server', version: '1.0.0' },
    }),
  ],
  providers: [EmojiService],
})
export class AppStdioModule {}
```

```typescript
// main.ts
import { NestFactory } from '@nestjs/core';
import { AppStdioModule } from './app/app-stdio.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(AppStdioModule);
  // No HTTP listener — the module connects to stdin/stdout on init
}
bootstrap();
```

The server starts listening on stdin/stdout as soon as the NestJS application context initializes. Tools, resources, and prompts are discovered and registered automatically.

### Custom streams

For testing or non-standard setups, you can provide custom `stdin`/`stdout` streams:

```typescript
import { PassThrough } from 'node:stream';

const stdin = new PassThrough();
const stdout = new PassThrough();

// Log outgoing MCP messages for debugging
stdout.on('data', (chunk: Buffer) => {
  console.debug('[mcp:out]', chunk.toString());
});

McpStdioModule.registerAndServeStdio({
  metadata: { name: 'test-server', version: '1.0.0' },
  stdin,
  stdout,
});

// Simulate an incoming JSON-RPC request
stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }) + '\n');
```

## Quick start: Registry only

Use `McpRegistryModule.registerOnly()` when you need the tool registry without any MCP transport — for example, in a process that calls an LLM provider directly (via `@onivoro/server-mcp-llm-adapter`), or in tests.

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { McpRegistryModule } from '@onivoro/server-mcp';
import { LlmAdapterModule } from '@onivoro/server-mcp-llm-adapter';
import { EmojiService } from './services/emoji.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    McpRegistryModule.registerOnly(),
    LlmAdapterModule.forBedrockConverse(),  // or forOpenAi(), forClaude(), etc.
  ],
  providers: [EmojiService, ChatService],
})
export class AppModule {}
```

See [`@onivoro/server-mcp-llm-adapter`](../mcp-llm-adapter/README.md) for provider-specific usage.

### Custom transport

`registerOnly()` also works when you need to bring your own MCP transport — for example, the legacy SSE transport, a WebSocket transport, or any custom protocol. The registry populates during module init; you then wire it to an `McpServer` instance connected to whatever transport you need:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpToolRegistry, wireRegistryToServer, buildCapabilities } from '@onivoro/server-mcp';

@Injectable()
export class CustomTransportService implements OnModuleInit {
  constructor(private readonly registry: McpToolRegistry) {}

  async onModuleInit() {
    const server = new McpServer(
      { name: 'my-server', version: '1.0.0' },
      { capabilities: buildCapabilities(this.registry) },
    );

    wireRegistryToServer(this.registry, server);

    // Connect to any transport — SSE, WebSocket, custom protocol, etc.
    const transport = new SSEServerTransport('/messages', response);
    await server.connect(transport);
  }
}
```

`wireRegistryToServer` and `buildCapabilities` are independent — `buildCapabilities` derives capabilities from the registry, and `wireRegistryToServer` registers entries onto the server without touching capabilities. To add capabilities beyond what the registry provides (e.g. `logging`, `experimental`), merge them:

```typescript
const capabilities = { ...buildCapabilities(this.registry), logging: {} };
const server = new McpServer({ name: 'my-server', version: '1.0.0' }, { capabilities });
```

Or skip `buildCapabilities` entirely and pass your own capabilities object. Both helpers are the same ones that `McpHttpModule` and `McpStdioModule` use internally.

## Defining tools

Declare the schema as a `z.ZodObject`, then reuse it with `z.infer` for type-safe params:

```typescript
import { Injectable } from '@nestjs/common';
import { McpTool } from '@onivoro/server-mcp';
import { z } from 'zod';

const insertEmojisSchema = z.object({
  text: z.string().describe('The text to enhance with emojis'),
  intensity: z.enum(['subtle', 'moderate', 'heavy']).optional().describe('Emoji density'),
});

@Injectable()
export class EmojiService {
  @McpTool(
    'insert-emojis',
    'Insert emojis into text based on semantic meaning',
    insertEmojisSchema,
    { bedrock: 'insert_emojis' },  // explicit alias for consumer libraries (optional)
  )
  async insertEmojis(params: z.infer<typeof insertEmojisSchema>) {
    const enhanced = this.addEmojis(params.text, params.intensity);
    return { text: enhanced, emojiCount: 5 };
  }

  // ...business logic...
}
```

The `z.infer<typeof insertEmojisSchema>` resolves to `{ text: string; intensity?: "subtle" | "moderate" | "heavy" }` at compile time — the schema and the params type can never drift apart.

### Return value handling

Your `@McpTool` methods can return any of these — the registry wraps automatically based on how the tool is consumed:

| Your method returns | `executeToolRaw()` (raw) | `executeToolWrapped()` (MCP) |
|---|---|---|
| `{ content: [{ type: 'text', text: '...' }] }` | Passed through | Passed through |
| `{ content: [{ type: 'image', data: '...', mimeType: '...' }] }` | Passed through | Passed through |
| `'plain string'` | `'plain string'` | `{ content: [{ type: 'text', text: 'plain string' }] }` |
| `{ key: 'value' }` | `{ key: 'value' }` | `{ content: [{ type: 'text', text: '...' }] }` (JSON-stringified) |

When auto-wrapping, the result is always wrapped as `type: 'text'`. If you need to return other content types, return the full `McpToolResult` structure directly — it passes through unchanged.

### MCP content types

The MCP spec defines five content block types for tool results:

| Type | Interface | Use case |
|------|-----------|----------|
| `text` | `McpTextContent` | Plain text or markdown |
| `image` | `McpImageContent` | Base64-encoded image (`data` + `mimeType`) |
| `audio` | `McpAudioContent` | Base64-encoded audio (`data` + `mimeType`) |
| `resource` | `McpEmbeddedResource` | Inline resource content (`uri` + `text` or `blob`) |
| `resource_link` | `McpResourceLink` | Link to a resource (`uri` + `name`) |

All content blocks support optional `annotations` with `audience` (`'user'`, `'assistant'`, or both) and `priority` fields. These types are exported from the library as `McpContentBlock` (the union) and the individual interfaces.

### Aliases

Consumer-specific libraries may require different tool naming conventions. The `aliases` parameter accepts a `Record<string, string>` where each key is a consumer identifier:

```typescript
@McpTool('my-tool', 'description', myToolSchema, { bedrock: 'my_tool' })
```

The `aliases` parameter is optional. Consumer libraries read the alias key they care about (e.g. `@onivoro/server-mcp-llm-adapter` reads `aliases['bedrock']` for Bedrock Converse) falling back to the first argument provided to the decorator.

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

The registry is the core of the library. It is injectable in any NestJS service when any of the three entry point modules is imported.

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

### Execution

| Method | Input name | Returns | Use when |
|--------|-----------|---------|----------|
| `executeToolRaw(name, params)` | MCP name | Raw handler result | Direct programmatic access, tests |
| `executeToolWrapped(name, params)` | MCP name | `McpToolResult` (auto-wrapped) | MCP HTTP and stdio transports |

### Schema conversion

| Method | Returns |
|--------|---------|
| `getToolJsonSchemas()` | `Array<{ name, description, jsonSchema }>` — generic JSON Schema |

## Configuration

### McpHttpModule (HTTP)

```typescript
McpHttpModule.registerAndServeHttp({
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

### McpStdioModule (Stdio)

```typescript
McpStdioModule.registerAndServeStdio({
  metadata: {
    name: 'my-server',        // Required. Server name reported to MCP clients.
    version: '1.0.0',         // Required. Server version.
    description: 'Optional',  // Optional. Human-readable description.
  },
  serverOptions: {},           // Optional. Passed to McpServer from @modelcontextprotocol/sdk.
  stdin: process.stdin,        // Optional. Defaults to process.stdin.
  stdout: process.stdout,      // Optional. Defaults to process.stdout.
});
```

## Authentication

Authentication is handled by standard NestJS middleware, not by this library:

```typescript
const routePrefix = 'what/ever/';

@Module({
  imports: [McpHttpModule.registerAndServeHttp({ routePrefix, ... })],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MyAuthMiddleware).forRoutes(`${routePrefix}/mcp`);
  }
}
```

## CORS

The library exports constants for MCP protocol compliance:

| Export | Values |
|--------|--------|
| `MCP_CORS_METHODS` | `GET`, `POST`, `DELETE`, `OPTIONS` |
| `MCP_CORS_ALLOWED_HEADERS` | `Content-Type`, `Accept`, `Authorization`, `x-api-key`, `Mcp-Session-Id`, `Mcp-Protocol-Version`, `Last-Event-ID` |
| `MCP_CORS_EXPOSED_HEADERS` | `Mcp-Session-Id`, `Mcp-Protocol-Version` |
| `MCP_CORS_CONFIG` | Complete CORS config object combining the above (pass directly to `app.enableCors()`) |

## Transport lifecycle

### HTTP (`McpHttpModule`)

This library implements the **Streamable HTTP** transport, not the legacy SSE transport:

- **SSE transport (legacy)**: Two endpoints — `GET /sse` opens a persistent SSE stream for server-to-client messages, `POST /messages` sends client-to-server requests. This was the original MCP HTTP transport.
- **Streamable HTTP (current)**: Single `POST /mcp` endpoint. Responses can be either JSON or SSE streams depending on the `Accept` header. When a client sends `text/event-stream` in its accept header, the server can stream responses over the same POST connection.

Each MCP client connection creates a session, identified by the `Mcp-Session-Id` header.

- Sessions are created on the first `POST /mcp` (the `initialize` handshake).
- Sessions are destroyed on `DELETE /mcp` or when the idle TTL expires.
- The default idle TTL is 30 minutes, configurable via `sessionTtlMinutes`.
- All sessions are cleaned up on application shutdown.

### Stdio (`McpStdioModule`)

A single `McpServer` is created and connected to `StdioServerTransport` during `onModuleInit`. There are no sessions — the server runs for the lifetime of the process.

- The server starts automatically when the NestJS application context initializes.
- The transport and server are closed on application shutdown (`onModuleDestroy`).
- Use `NestFactory.createApplicationContext()` instead of `NestFactory.create()` — there's no HTTP listener.

### Registry only (`McpRegistryModule`)

No transport is created. Tools are discovered and registered into `McpToolRegistry` during module init. You call the registry's execution methods directly from your own code, or use the adapter library `@onivoro/server-mcp-llm-adapter`.

## Exports

```typescript
// Modules
McpHttpModule                // HTTP transport — use McpHttpModule.registerAndServeHttp()
McpStdioModule               // Stdio transport — use McpStdioModule.registerAndServeStdio()
McpRegistryModule            // Registry only — use McpRegistryModule.registerOnly()

// Registry
McpToolRegistry              // Injectable registry — execution, introspection, schema conversion
McpToolResult                // { content: McpContentBlock[] }
McpContentBlock              // Union of all MCP content types
McpTextContent               // { type: 'text', text, annotations? }
McpImageContent              // { type: 'image', data, mimeType, annotations? }
McpAudioContent              // { type: 'audio', data, mimeType, annotations? }
McpEmbeddedResource          // { type: 'resource', resource: { uri, text?, blob? }, annotations? }
McpResourceLink              // { type: 'resource_link', uri, name, mimeType?, annotations? }

// Decorators
McpTool                      // Method decorator for tools (schema: z.ZodObject)
McpResource                  // Method decorator for resources
McpPrompt                    // Method decorator for prompts

// Schema converters
mcpSchemaToJsonSchema        // z.ZodObject → JSON Schema object (via zod v4 native z.toJSONSchema)

// Wiring helpers
wireRegistryToServer         // Register all tools/resources/prompts from registry onto an McpServer
buildCapabilities            // Build MCP capabilities object from current registry state

// Interfaces
McpModuleConfig              // Configuration for McpHttpModule.registerAndServeHttp()
McpStdioConfig               // Configuration for McpStdioModule.registerAndServeStdio()
McpServerMetadata            // { name, version, description? }
McpToolMetadata              // { name, description, schema?: z.ZodObject, aliases?: Record<string, string> }
McpResourceMetadata          // { name, uri, description?, mimeType?, isTemplate? }
McpPromptMetadata            // { name, description?, argsSchema? }

// Service
McpService                   // HTTP session manager (rarely needed directly)

// Constants
MCP_MODULE_CONFIG            // DI token for McpHttpModule config
MCP_STDIO_CONFIG             // DI token for McpStdioModule config
MCP_TOOL_METADATA            // Reflect metadata key
MCP_RESOURCE_METADATA        // Reflect metadata key
MCP_PROMPT_METADATA          // Reflect metadata key
MCP_CORS_METHODS             // CORS methods array
MCP_CORS_ALLOWED_HEADERS     // CORS allowed headers array
MCP_CORS_EXPOSED_HEADERS     // CORS exposed headers array
MCP_CORS_CONFIG              // Complete CORS config object (methods, allowedHeaders, exposedHeaders)
```

## Consumer libraries

| Library | Purpose |
|---------|---------|
| [`@onivoro/server-mcp-llm-adapter`](../mcp-llm-adapter/README.md) | Generic LLM adapter — Bedrock Converse, OpenAI, Anthropic, Gemini, Mistral |

## Peer dependencies

```json
{
  "@modelcontextprotocol/sdk": "^1.28.0",
  "@nestjs/common": "^10.0.0 || ^11.0.0",
  "@nestjs/core": "^10.0.0 || ^11.0.0",
  "zod": "^4.0.0"
}
```

## Recommended patterns

### Separate business logic from MCP presentation

Keep business logic in a domain-specific library that returns structured JSON. Put `@McpTool`-decorated methods in a separate MCP adapter library that formats the JSON for human-readable display.

```
libs/server/emojeez/        ← business logic, returns typed result objects
libs/mcp/emojeez/           ← @McpTool adapters, formats results as markdown
```

This separation means the same business logic can be consumed by MCP tools, REST APIs, CLI commands, or tests — each with its own presentation layer.

```typescript
// libs/server/emojeez — business logic
@Injectable()
export class EmojiService {
  async insertEmojis(params: z.infer<typeof insertEmojisSchema>): Promise<InsertEmojisResult> {
    // ... returns { enhancedText, intensity, emoji_style }
  }
}

// libs/mcp/emojeez — MCP adapter
// this is optional, but preferred (for larger codebases) instead of just bolting the @McpTool decorator onto an existing service (which IS supported nonetheless)
@Injectable()
export class EmojiToolService {
  constructor(private readonly emoji: EmojiService) {}

  @McpTool('insert-emojis', 'Insert emojis into text', insertEmojisSchema)
  async insertEmojis(params: z.infer<typeof insertEmojisSchema>) {
    const result = await this.emoji.insertEmojis(params);
    return `**Enhanced Text:**\n\n${result.enhancedText}\n\n*Level: ${result.intensity}*`;
  }
}
```

### Keep Zod schemas in the business logic library

Hot take🔥: If you're not using Zod, you should probably start using it and drop all other validation strategies.

If you're already using (isomorphic) Zod schemas for server/client validation, this recommendation won't require any changes at all. If you are not using Zod yet, you will need to create Zod schemas for your MCP server.

Ideally, keep your Zod schemas in the business logic library (or a shared isomorphic library if you also use them in the browser) and export them. Both the service (`z.infer`) and the MCP adapter (`@McpTool` decorator) consume the same schema — types and validation can never drift apart.

```typescript
// libs/server/emojeez/src/lib/emoji.schemas.ts
export const insertEmojisSchema = z.object({
  text: z.string().describe('The text to enhance with emojis'),
  intensity: z.enum(['subtle', 'moderate', 'heavy']).optional(),
});
```

### Shared MCP adapter libraries

When multiple apps serve the same tools (e.g. an HTTP MCP server and a stdio MCP server), put `@McpTool` services in a shared `libs/mcp/{domain}` library. Each app imports the shared module instead of defining its own tool services.

```typescript
// apps/mcp-http/emojeez — HTTP server
@Module({
  imports: [McpHttpModule.registerAndServeHttp({ ... }), EmojeezMcpModule],
})
export class AppModule {}

// apps/mcp-stdio/emojeez — stdio server
@Module({
  imports: [McpStdioModule.registerAndServeStdio({ ... }), EmojeezMcpModule],
})
export class AppModule {}
```
