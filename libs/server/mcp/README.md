# @onivoro/server-mcp

A NestJS library for building transport-agnostic MCP tool services. Define tools once with decorators, consume them over HTTP, stdio, or directly via the registry. The documentation and examples generally focus one enterprise monorepos but can be easily adapted to single apps.

## Why this library exists

MCP tools are business logic with a protocol wrapper. The problem is that the same tools often need to be consumed in multiple contexts: an MCP HTTP server for Claude Desktop, a stdio process for a VS Code extension, a direct function call from a test or CLI. Without a shared registry, you end up duplicating tool definitions, schemas, and dispatch logic for each transport.

This library solves that by separating **tool definition** (decorators on NestJS services) from **tool consumption** (HTTP sessions, stdio, raw execution). You write your tools once. The registry handles discovery, schema conversion, and per-consumer format wrapping automatically.

Consumer-specific formatting (e.g. Bedrock Converse tool definitions, OpenAI function calling, Anthropic Messages API) lives in a separate adapter library that layers on top of the registry. See [`@onivoro/server-mcp-llm-adapter`](https://www.npmjs.com/package/@onivoro/server-mcp-llm-adapter) for the generic LLM adapter.

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
- **Auth-aware execution**: MCP SDK `authInfo`, `sessionId`, `signal` (AbortSignal), and `sendProgress` flow through the registry to tool handlers. Centralized auth enrichment via `McpAuthProvider`, per-tool authorization via `@McpGuard`.
- **Extensible execution pipeline**: Guards, interceptors, and the handler compose in the same order as the NestJS HTTP lifecycle. Interceptors use the `intercept(context, next)` onion model.

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

### Platform requirement

`McpHttpModule` requires NestJS's Express platform (`@nestjs/platform-express`), which is the default when you call `NestFactory.create()`. It depends on Express body-parsing middleware to parse incoming request bodies.

If your application uses `@nestjs/platform-fastify`, use `McpRegistryModule.registerOnly()` and write a custom Fastify-aware controller. The `McpHttpService.handleRequest()` method accepts raw Node `http.IncomingMessage` and `http.ServerResponse` — you only need to extract the parsed body from Fastify's request and pass it correctly.

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
import { McpLlmAdapterModule } from '@onivoro/server-mcp-llm-adapter';
import { EmojiService } from './services/emoji.service';
import { ChatService } from './services/chat.service';

@Module({
  imports: [
    McpRegistryModule.registerOnly(),
    McpLlmAdapterModule.forBedrockConverse(),  // or forOpenAi(), forClaude(), etc.
  ],
  providers: [EmojiService, ChatService],
})
export class AppModule {}
```

See [`@onivoro/server-mcp-llm-adapter`](https://www.npmjs.com/package/@onivoro/server-mcp-llm-adapter) for provider-specific usage.

### Custom transport

`registerOnly()` also works when you need to bring your own MCP transport — for example, the legacy SSE transport, a WebSocket transport, or any custom protocol. The registry populates during module init; you then wire it to an `McpServer` instance connected to whatever transport you need:

```typescript
import { Injectable, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { McpToolRegistry, wireRegistryToServer, buildCapabilities } from '@onivoro/server-mcp';

@Injectable()
export class CustomTransportService implements OnModuleInit, OnModuleDestroy {
  private unsubscribe?: () => void;

  constructor(private readonly registry: McpToolRegistry) {}

  async onModuleInit() {
    const server = new McpServer(
      { name: 'my-server', version: '1.0.0' },
      { capabilities: buildCapabilities(this.registry) },
    );

    // Wires existing entries and subscribes to future registrations.
    // Returns an unsubscribe function for cleanup.
    this.unsubscribe = wireRegistryToServer(this.registry, server);

    // Connect to any transport — SSE, WebSocket, custom protocol, etc.
    const transport = new SSEServerTransport('/messages', response);
    await server.connect(transport);
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }
}
```

`wireRegistryToServer` and `buildCapabilities` are independent — `buildCapabilities` derives capabilities from the registry (including `listChanged: true`), and `wireRegistryToServer` registers entries onto the server without touching capabilities. `wireRegistryToServer` also subscribes to future registration changes, so tools/resources/prompts added dynamically after startup are automatically wired to the server (triggering `listChanged` notifications to connected clients). To add capabilities beyond what the registry provides (e.g. `logging`, `experimental`), merge them:

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
  @McpTool({
    name: 'insert-emojis',
    description: 'Insert emojis into text based on semantic meaning',
    schema: insertEmojisSchema,
    aliases: { bedrock: 'insert_emojis' },  // explicit alias for consumer libraries (optional)
  })
  async insertEmojis(params: z.infer<typeof insertEmojisSchema>) {
    const enhanced = this.addEmojis(params.text, params.intensity);
    return { text: enhanced, emojiCount: 5 };
  }

  // ...business logic...
}
```

The `z.infer<typeof insertEmojisSchema>` resolves to `{ text: string; intensity?: "subtle" | "moderate" | "heavy" }` at compile time — the schema and the params type can never drift apart.

### Decorator forms

`@McpTool` accepts a single metadata object — the same pattern as `@McpResource` and `@McpPrompt`:

```typescript
@McpTool({
  name: 'insert-emojis',
  description: 'Insert emojis into text',
  schema: insertEmojisSchema,
  title: 'Insert Emojis',
  aliases: { bedrock: 'insert_emojis' },
  annotations: { readOnlyHint: false },
})
```

All three decorators (`@McpTool`, `@McpResource`, `@McpPrompt`) follow the same pattern — a single metadata object.

### Accessing auth context

Tool handlers receive an optional second parameter — `McpToolContext` — containing the tool name, parameters, metadata, and any `authInfo` from the MCP transport layer:

```typescript
import { McpTool, McpToolContext } from '@onivoro/server-mcp';

@McpTool({ name: 'delete-item', description: 'Delete an item', schema: deleteItemSchema })
async deleteItem(
  params: z.infer<typeof deleteItemSchema>,
  context?: McpToolContext,
) {
  // context.authInfo is populated when the MCP client authenticated via OAuth 2.1
  if (context?.authInfo) {
    console.log(`Client ${context.authInfo.clientId} with scopes: ${context.authInfo.scopes}`);
  }
  return this.itemService.delete(params.id);
}
```

The second parameter is entirely optional — existing handlers that only accept `params` continue to work unchanged. For declarative auth, see [Guards](#guards) below.

### Progress reporting

Long-running tools can report incremental progress to MCP clients. When a client includes a `progressToken` in the request's `_meta`, the registry provides a `sendProgress` function on the context:

```typescript
import { McpTool, McpToolContext } from '@onivoro/server-mcp';

const importSchema = z.object({
  url: z.string().url().describe('URL of the dataset to import'),
});

@Injectable()
export class DataService {
  @McpTool({ name: 'import-data', description: 'Import a large dataset', schema: importSchema })
  async importData(
    params: z.infer<typeof importSchema>,
    context?: McpToolContext,
  ) {
    const rows = await this.fetchRows(params.url);

    for (let i = 0; i < rows.length; i++) {
      await this.processRow(rows[i]);
      await context?.sendProgress?.(i + 1, rows.length, `Processing row ${i + 1}`);
    }

    return `Imported ${rows.length} rows`;
  }
}
```

`sendProgress(progress, total?, message?)` sends a `notifications/progress` notification to the client:

| Parameter | Type | Description |
|-----------|------|-------------|
| `progress` | `number` | Current progress value. Should increase monotonically. |
| `total` | `number?` | Total expected value (enables percentage display in client UIs). |
| `message` | `string?` | Human-readable description of current step. |

The `?.` chain on `context?.sendProgress?.()` is important — `sendProgress` is only populated when the client requested progress tracking via `_meta.progressToken`. Clients that don't request progress (most do not by default) leave it `undefined`, and the optional chain makes the call a safe no-op.

### Cancellation via AbortSignal

The context also carries `signal` — an `AbortSignal` that fires when the client cancels the request. Use it to abort expensive work early:

```typescript
@McpTool({ name: 'import-data', description: 'Import a large dataset', schema: importSchema })
async importData(
  params: z.infer<typeof importSchema>,
  context?: McpToolContext,
) {
  const rows = await this.fetchRows(params.url);

  for (let i = 0; i < rows.length; i++) {
    if (context?.signal?.aborted) {
      return `Import cancelled after ${i} of ${rows.length} rows`;
    }
    await this.processRow(rows[i]);
    await context?.sendProgress?.(i + 1, rows.length);
  }

  return `Imported ${rows.length} rows`;
}
```

`signal` is an instance of the standard web `AbortSignal`. You can also pass it to APIs that accept abort signals (e.g. `fetch(url, { signal: context.signal })`).

### Session tracking

The context includes `sessionId` — the MCP session identifier from the transport layer. This is useful for per-session caching, rate limiting, or audit logging:

```typescript
@McpTool({ name: 'get-status', description: 'Get system status', schema: statusSchema })
async getStatus(
  params: z.infer<typeof statusSchema>,
  context?: McpToolContext,
) {
  this.logger.log(`Status check from session ${context?.sessionId}`);
  return this.statusService.getStatus();
}
```

`sessionId` is set by the HTTP transport (each client connection gets a unique session). For stdio, there is a single session for the lifetime of the process.

### Logging

Tool handlers can send structured log messages to MCP clients via `context.sendLog()`. The client controls the minimum log level via the `logging/setLevel` protocol message.

```typescript
@McpTool({ name: 'import-data', description: 'Import data from source', schema: importSchema })
async importData(params: z.infer<typeof importSchema>, context?: McpToolContext) {
  await context?.sendLog?.('info', { phase: 'starting', source: params.source }, 'import-data');
  const result = await this.importService.run(params.source);
  await context?.sendLog?.('info', { phase: 'complete', count: result.count }, 'import-data');
  return result;
}
```

The `sendLog` signature is `(level: McpLogLevel, data: unknown, logger?: string) => Promise<void>`. Levels follow RFC 5424: `debug`, `info`, `notice`, `warning`, `error`, `critical`, `alert`, `emergency`.

### Resource subscriptions

Clients can subscribe to resource change notifications. When your application data changes, call `notifyResourceUpdated(uri)` on the registry to push `notifications/resources/updated` to subscribed clients:

```typescript
@Injectable()
export class ConfigService {
  constructor(private readonly registry: McpToolRegistry) {}

  async updateConfig(key: string, value: string) {
    await this.configStore.set(key, value);
    this.registry.notifyResourceUpdated('app://config');
  }
}
```

The library handles `resources/subscribe` and `resources/unsubscribe` requests automatically. Subscriptions are cleaned up when sessions close.

### Resource template completion

Resource templates can provide autocompletion for URI variables and listing via injectable providers. Both `listProvider` and `completeProvider` are resolved through NestJS DI, so they can inject any service:

```typescript
@Injectable()
export class UserListProvider implements McpResourceListProvider {
  constructor(private readonly userService: UserService) {}

  async list() {
    const users = await this.userService.findAll();
    return { resources: users.map(u => ({ uri: `app://users/${u.id}`, name: u.name })) };
  }
}

@Injectable()
export class UserCompleter implements McpCompletionProvider {
  constructor(private readonly userService: UserService) {}

  async complete(argName: string, value: string) {
    if (argName === 'userId') {
      const users = await this.userService.search(value);
      return users.map(u => u.id);
    }
    return [];
  }
}

// In the service:
@McpResource({
  name: 'user-profile',
  uri: 'app://users/{userId}',
  isTemplate: true,
  listProvider: UserListProvider,
  completeProvider: UserCompleter,
})
async getProfile(uri: URL, variables: { userId: string }) {
  return { contents: [{ uri: uri.href, text: JSON.stringify(await this.userService.get(variables.userId)) }] };
}
```

Both providers must be registered as NestJS providers (e.g., in the module's `providers` array or exported from an imported module).

### Output schema

Tools can declare an output schema for structured output validation. When present, the SDK validates `structuredContent` against this schema and advertises it to clients:

```typescript
const resultSchema = z.object({ count: z.number(), items: z.array(z.string()) });

@McpTool({ name: 'list-items', description: 'List all items', schema: inputSchema, outputSchema: resultSchema })
async listItems(params: z.infer<typeof inputSchema>) {
  const items = await this.itemService.list(params.filter);
  return { content: [{ type: 'text', text: 'Done' }], structuredContent: { count: items.length, items } };
}
```

### Server instructions

Provide human-readable usage instructions that are included in the MCP `initialize` response:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: {
    name: 'my-server',
    version: '1.0.0',
    instructions: 'This server provides tools for managing customer data. Use list-customers first to find IDs.',
  },
})
```

### Tool enable/disable

Tools can be enabled or disabled at runtime. Disabled tools are hidden from `tools/list` and reject calls:

```typescript
@Injectable()
export class FeatureFlagService {
  constructor(private readonly registry: McpToolRegistry) {}

  async onFeatureToggle(feature: string, enabled: boolean) {
    if (feature === 'experimental-tool') {
      this.registry.setToolEnabled('experimental-tool', enabled);
    }
  }
}
```

### Sampling, elicitation, and roots

Tool handlers have access to client capabilities via context callbacks:

- `context.createMessage(params)` — request LLM sampling from the client
- `context.elicitInput(params)` — request user input via a form or URL
- `context.listRoots()` — request the client's filesystem roots

These are always present on the context but may reject if the client doesn't support the capability. Wrap calls in try/catch.

### Icons

Tools, resources, and prompts can provide icons for client UI rendering (spec 2025-11-25+):

```typescript
@McpTool({
  name: 'deploy-app',
  description: 'Deploy application',
  schema: deploySchema,
  icons: [
    { url: 'https://cdn.example.com/deploy-icon.svg', mediaType: 'image/svg+xml' },
    { url: 'https://cdn.example.com/deploy-icon-32.png', mediaType: 'image/png', size: '32x32' },
  ],
})
async deploy(params: z.infer<typeof deploySchema>) { ... }
```

Resources and prompts accept `icons` in their metadata object:

```typescript
@McpResource({
  name: 'logs',
  uri: 'app://logs',
  icons: [{ url: 'https://cdn.example.com/logs.svg' }],
})
```

### Resource annotations

Resources can declare audience targeting, priority, and last modification time:

```typescript
@McpResource({
  name: 'system-status',
  uri: 'app://status',
  annotations: {
    audience: ['user'],      // intended for human consumption
    priority: 0.9,           // high priority (0.0–1.0)
    lastModified: '2026-04-20T10:00:00Z',
  },
})
async getStatus() { ... }
```

### Prompt argument completions

Prompts can provide autocompletion for their arguments via an injectable `completeProvider`:

```typescript
@Injectable()
export class LanguageCompleter implements McpCompletionProvider {
  async complete(argName: string, value: string) {
    if (argName === 'language') {
      return ['typescript', 'python', 'rust', 'go'].filter(l => l.startsWith(value));
    }
    return [];
  }
}

// In the service:
@McpPrompt({
  name: 'generate-code',
  description: 'Generate code in a specific language',
  argsSchema: { language: z.string(), task: z.string() },
  completeProvider: LanguageCompleter,
})
async generateCode(params: { language: string; task: string }) {
  return { messages: [{ role: 'user', content: { type: 'text', text: `Write ${params.language}: ${params.task}` } }] };
}
```

### Async module configuration

When config must be resolved at runtime (e.g., from a config service, environment, or secret manager), use the async factory methods:

```typescript
import { McpHttpModule } from '@onivoro/server-mcp';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [
    McpHttpModule.registerAndServeHttpAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        metadata: {
          name: config.get('MCP_SERVER_NAME'),
          version: config.get('MCP_SERVER_VERSION'),
          description: config.get('MCP_SERVER_DESCRIPTION'),
        },
        allowedOrigins: config.get<string[]>('MCP_ALLOWED_ORIGINS'),
      }),
    }),
  ],
})
export class AppModule {}
```

The stdio equivalent is `McpStdioModule.registerAndServeStdioAsync()` with the same `{ imports, inject, useFactory }` shape.

### Input validation

When a tool has a Zod schema, the registry runs `schema.parse(params)` as the **Pipes** stage of the [execution pipeline](#execution-pipeline) — after guards but before hooks and the handler. This means:

- **Unauthorized calls are rejected before validation** — guards run first, so invalid params never waste time parsing if the call isn't authorized.
- **Invalid params are rejected** with a `ZodError` before hooks or the handler execute.
- **Defaults and transforms are applied** — if your schema has `.default()` or `.transform()`, hooks and the handler receive the fully processed params, not the raw input.
- **Refinements are enforced** — `.refine()` and `.superRefine()` checks run, even though they can't be expressed in JSON Schema.

On the MCP transport path (HTTP/stdio), the MCP SDK also validates incoming params against the JSON Schema representation of the Zod schema. The registry's validation is intentionally redundant on that path — it ensures that the programmatic path (`executeToolRaw`, `executeToolForProvider`) gets the same guarantees without relying on the SDK.

Tools without a schema accept any params without validation.

### Return value handling

Your `@McpTool` methods can return any of these — the registry wraps automatically based on how the tool is consumed:

| Your method returns | `executeToolRaw()` (raw) | `executeToolWrapped()` (MCP) |
|---|---|---|
| `{ content: [{ type: 'text', text: '...' }] }` | Passed through | Passed through |
| `{ content: [{ type: 'image', data: '...', mimeType: '...' }] }` | Passed through | Passed through |
| `'plain string'` | `'plain string'` | `{ content: [{ type: 'text', text: 'plain string' }] }` |
| `{ key: 'value' }` | `{ key: 'value' }` | `{ content: [{ type: 'text', text: '...' }] }` (JSON-stringified) |

When auto-wrapping, the result is always wrapped as `type: 'text'`. If you need to return other content types, return the full `McpToolResult` structure directly — it passes through unchanged.

#### Resource return value handling

`@McpResource` handlers benefit from the same auto-wrapping. Return a plain value and it becomes the correct `{ contents: [...] }` shape:

| Your method returns | What the MCP client receives |
|---|---|
| `{ contents: [{ uri, text: '...' }] }` | Passed through |
| `'plain string'` | `{ contents: [{ uri, mimeType: 'text/plain', text: 'plain string' }] }` |
| `{ key: 'value' }` | `{ contents: [{ uri, mimeType: 'application/json', text: '...' }] }` (JSON-stringified) |

The `uri` is automatically populated from the request. When the resource metadata specifies a `mimeType`, that value is used instead of the defaults (`text/plain` for strings, `application/json` for objects). If you need to return binary content or multiple content items, return the full `McpResourceResult` structure directly.

#### Prompt return value handling

`@McpPrompt` handlers work the same way:

| Your method returns | What the MCP client receives |
|---|---|
| `{ messages: [{ role: 'user', content: { type: 'text', text: '...' } }] }` | Passed through |
| `'Generate a summary'` | `{ messages: [{ role: 'user', content: { type: 'text', text: 'Generate a summary' } }] }` |
| `{ topic: 'testing' }` | `{ messages: [{ role: 'user', content: { type: 'text', text: '...' } }] }` (JSON-stringified) |

Auto-wrapped prompts always use `role: 'user'`. If you need assistant messages, multiple messages, or non-text content, return the full `McpPromptResult` structure directly.

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

Consumer-specific libraries may require different tool naming conventions. The `aliases` field accepts a `Record<string, string>` where each key is a consumer identifier:

```typescript
@McpTool({
  name: 'my-tool',
  description: 'description',
  schema: myToolSchema,
  aliases: { bedrock: 'my_tool' },
})
```

The `aliases` field is optional. Consumer libraries read the alias key they care about (e.g. `@onivoro/server-mcp-llm-adapter` reads `aliases['bedrock']` for Bedrock Converse) falling back to `name`.

### Tool annotations

The MCP spec defines behavioral hints that clients use for UX decisions — for example, Claude Desktop skips confirmation prompts for tools marked `readOnlyHint: true`:

```typescript
@McpTool({
  name: 'list-items',
  description: 'List all items',
  schema: listItemsSchema,
  annotations: { readOnlyHint: true, openWorldHint: false },
})
async listItems(params: z.infer<typeof listItemsSchema>) { ... }
```

With aliases and annotations together:

```typescript
@McpTool({
  name: 'delete-item',
  description: 'Delete an item permanently',
  schema: deleteItemSchema,
  aliases: { bedrock: 'delete_item' },
  annotations: { destructiveHint: true },
})
async deleteItem(params: z.infer<typeof deleteItemSchema>) { ... }
```

| Annotation | Type | Meaning |
|------------|------|---------|
| `readOnlyHint` | `boolean` | Tool does not modify its environment |
| `destructiveHint` | `boolean` | Tool may perform destructive updates (delete, overwrite) |
| `idempotentHint` | `boolean` | Repeated calls with the same args have no additional effect |
| `openWorldHint` | `boolean` | Tool may interact with external entities (network, third-party APIs) |

All annotations are optional and advisory — clients MAY use them but are not required to. Annotations are forwarded to the MCP SDK's `server.registerTool()` and appear in `tools/list` responses to MCP clients.

## Defining resources

```typescript
@McpResource({
  name: 'config',
  uri: 'app://config',
  description: 'Application configuration',
  mimeType: 'application/json',
})
async getConfig() {
  // Return a plain object — auto-wrapped into { contents: [{ uri, mimeType, text }] }
  return config;
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
  // Return a plain string — auto-wrapped into { messages: [{ role: 'user', content: { type: 'text', text } }] }
  return `Summarize: ${item.content}`;
}
```

## Execution pipeline

The registry's tool execution pipeline is modeled after the [NestJS HTTP request lifecycle](https://docs.nestjs.com/faq/request-lifecycle). If you're familiar with how NestJS processes an HTTP request through middleware, guards, pipes, interceptors, and exception filters, the same mental model applies here — each stage has a direct analog in the MCP tool pipeline.

| Stage | NestJS HTTP | MCP Registry | Responsibility |
|:-----:|---|---|---|
| 1 | Middleware | Transport layer | NestJS middleware on the MCP route (authentication, logging) |
| 2 | — | Auth provider | Centralized auth enrichment/validation (`McpAuthProvider.resolveAuth`) |
| 3 | Guards | `@McpGuard` | Authorization — should this call proceed? |
| 4 | Pipes | `schema.parse()` | Validation and transformation of input params (internally executed based on the Zod schema) |
| 5 | Interceptors | `McpToolInterceptor` chain | Cross-cutting concerns wrapping execution (auditing, caching, timing, transformation) |
| 6 | Route handler | Tool handler | Business logic (innermost `next()` of the interceptor chain) |
| 7 | Exception filters | `executeToolWrapped` try/catch | Error wrapping for MCP clients |

```
Transport middleware → Auth provider → Guards → Validation → Interceptor₁ → ... → Handler
                                                                  ↑                    |
                                                                  |   result ←── ←────┘
                                                                  ↓
                                                   executeToolWrapped catches errors
```

Interceptors use the **onion model** — identical to NestJS `NestInterceptor`. Each interceptor's `intercept(context, next)` wraps the next interceptor in the chain; the innermost `next()` calls the tool handler. This means each interceptor can run logic both before and after the handler in a single method.

**Key behaviors at each stage:**

- **Auth provider** (optional) runs first, transforming raw `authInfo` from the transport. All downstream stages (guards, interceptors, handler) receive the resolved auth. If the provider throws, execution stops immediately. See [Auth provider](#auth-provider-centralized-auth-enrichment).
- **Guards** receive raw (unvalidated) params but resolved auth. They check authorization, not input shape. If a guard rejects, validation never runs — an unauthorized caller doesn't get a validation error revealing your schema.
- **Validation** runs `schema.parse()`, applying Zod defaults, transforms, and refinements. From this point forward, all downstream stages (interceptors and handler) see the validated params.
- **Interceptors** see validated params and the full `McpToolContext`. Each interceptor decides whether to call `next()` (proceed) or short-circuit. They can also transform the result returned by `next()`.
- **Handler** receives validated params as the first argument and `McpToolContext` as the optional second argument. It is the innermost `next()` in the interceptor chain.
- **Error handling** in `executeToolWrapped` catches any error from any stage and returns it as MCP error content — the auth provider throwing, guards rejecting, validation failing, interceptors throwing, or the handler itself failing all produce structured error responses to the MCP client.

The pipeline runs identically regardless of transport — the same guards, validation, and interceptors apply whether the tool is called via MCP HTTP, MCP stdio, `executeToolRaw`, or `executeToolForProvider` from the LLM adapter.

## Guards

Guards provide declarative, per-tool authorization. They are the first stage of the execution pipeline — if a guard rejects, validation, hooks, and the handler never execute.

### Built-in scope guard

The library ships `McpScopeGuard`, which checks `authInfo.scopes` against a required scope list. All modules auto-provide it, so there's nothing to register:

```typescript
import { McpTool, McpGuard, McpScopeGuard } from '@onivoro/server-mcp';

@Injectable()
export class ItemService {
  @McpTool({ name: 'delete-item', description: 'Delete an item', schema: deleteItemSchema })
  @McpGuard(McpScopeGuard, { scopes: ['write'] })
  async deleteItem(params: z.infer<typeof deleteItemSchema>) {
    // Only reached if authInfo.scopes includes 'write'
    return this.items.delete(params.id);
  }
}
```

When the scope check fails, the registry throws `"Access denied by McpScopeGuard for tool "delete-item"."` — which `executeToolWrapped` catches and returns as error content to MCP clients.

### Custom guards

Implement `McpCanActivate` and register as a standard NestJS provider:

```typescript
import { Injectable } from '@nestjs/common';
import { McpCanActivate, McpToolContext } from '@onivoro/server-mcp';

@Injectable()
export class RateLimitGuard implements McpCanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(
    context: McpToolContext,
    config?: Record<string, unknown>,
  ): Promise<boolean> {
    const max = (config?.maxPerMinute as number) ?? 60;
    const key = context.authInfo?.clientId ?? 'anonymous';
    return this.rateLimiter.check(key, max);
  }
}
```

Then reference it in the decorator:

```typescript
@McpTool({ name: 'expensive-op', description: 'Expensive operation', schema })
@McpGuard(RateLimitGuard, { maxPerMinute: 10 })
async expensiveOp(params: z.infer<typeof schema>) { ... }
```

Custom guards must be registered as providers in the NestJS module tree (so the DI container can resolve them). The built-in `McpScopeGuard` is auto-provided by all MCP modules.

### Stacking guards

Multiple `@McpGuard` decorators stack. They run in top-to-bottom order; the first rejection stops execution:

```typescript
@McpTool({ name: 'admin-action', description: 'Admin only', schema })
@McpGuard(McpScopeGuard, { scopes: ['admin'] })
@McpGuard(RateLimitGuard, { maxPerMinute: 5 })
async adminAction(params: z.infer<typeof schema>) { ... }
```

## Interceptors

Interceptors are the NestJS interceptor analog in the [execution pipeline](#execution-pipeline) — cross-cutting concerns that wrap tool execution globally. Unlike guards (which are per-tool via decorators), interceptors run for every tool execution and follow the **onion model**: each interceptor wraps the next, with the innermost `next()` calling the tool handler.

This is the same `intercept(context, next)` pattern used by NestJS `NestInterceptor`. Each interceptor can run logic before and after the handler, transform the result, short-circuit execution, or handle errors — all in a single method.

### Defining an interceptor

Implement `McpToolInterceptor` as an injectable service:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { McpToolInterceptor, McpToolContext } from '@onivoro/server-mcp';

@Injectable()
export class AuditInterceptor implements McpToolInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  async intercept(context: McpToolContext, next: () => Promise<unknown>): Promise<unknown> {
    this.logger.log(`Tool call: ${context.toolName} by ${context.authInfo?.clientId ?? 'anonymous'}`);
    const start = Date.now();

    const result = await next();

    this.logger.log(`Tool completed: ${context.toolName} in ${Date.now() - start}ms`);
    return result;
  }
}
```

### Registering interceptors

Register interceptors directly on the registry, typically during module init:

```typescript
@Injectable()
export class AppService implements OnModuleInit {
  constructor(
    private readonly registry: McpToolRegistry,
    private readonly auditInterceptor: AuditInterceptor,
  ) {}

  onModuleInit() {
    this.registry.registerInterceptor(this.auditInterceptor);
  }
}
```

### Interceptor capabilities

Because interceptors wrap `next()`, they can do things that simple before/after hooks cannot:

- **Transform the result**: modify or replace the handler's return value.
- **Short-circuit execution**: return early without calling `next()` (e.g. caching).
- **Handle errors**: wrap `next()` in a try/catch for centralized error handling.
- **Measure timing**: capture start/end around the `next()` call.

```typescript
@Injectable()
export class CachingInterceptor implements McpToolInterceptor {
  constructor(private readonly cache: CacheService) {}

  async intercept(context: McpToolContext, next: () => Promise<unknown>): Promise<unknown> {
    const key = `${context.toolName}:${JSON.stringify(context.params)}`;
    const cached = this.cache.get(key);
    if (cached) return cached;           // short-circuit — handler never runs

    const result = await next();
    this.cache.set(key, result);
    return result;
  }
}
```

Multiple interceptors chain in registration order using the onion model. If interceptor A is registered before interceptor B, execution flows: A-before → B-before → handler → B-after → A-after. If any interceptor throws (or doesn't call `next()`), downstream interceptors and the handler are skipped.

## McpToolRegistry API

The registry is the core of the library. It is injectable in any NestJS service when any of the three entry point modules is imported.

### Registration

Called automatically by the module's discovery phase. You don't call these directly unless you're building custom infrastructure.

| Method | Description |
|--------|-------------|
| `registerTool(metadata, handler, guards?)` | Register a tool with optional guards. Throws on duplicate name. |
| `registerResource(metadata, handler)` | Register a resource. Throws on duplicate name. |
| `registerPrompt(metadata, handler)` | Register a prompt. Throws on duplicate name. |
| `registerInterceptor(interceptor)` | Register a `McpToolInterceptor` for all tool executions. |
| `setGuardResolver(resolver)` | Set the function used to resolve guard class instances. Called automatically by all modules. |
| `setAuthProvider(provider)` | Set the auth provider instance. Called automatically by modules when `authProvider` is configured. |
| `onRegistrationChange(listener)` | Subscribe to registration events (`'tool'`, `'resource'`, `'prompt'`). Returns an unsubscribe function. Used by `wireRegistryToServer` for dynamic wiring. |

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
| `executeToolRaw(name, params, authInfo?, extra?)` | MCP name | Raw handler result | Direct programmatic access, tests |
| `executeToolWrapped(name, params, authInfo?, extra?)` | MCP name | `McpToolResult` (auto-wrapped) | MCP HTTP and stdio transports |

The optional `authInfo` parameter is populated automatically by `wireRegistryToServer` (from the MCP SDK's request handler extra). When calling the registry directly, pass it if you have auth context available. The optional `extra` parameter carries transport-level context (`sessionId`, `signal`, `sendProgress`) — also populated automatically by `wireRegistryToServer`. Both methods run the full [execution pipeline](#execution-pipeline): guards → validation → interceptors → handler.

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
  allowedOrigins: [            // Optional. DNS rebinding protection (see below).
    'http://localhost:3000',
    'https://my-app.example.com',
  ],
  authProvider: JwtAuthProvider, // Optional. @Injectable() class implementing McpAuthProvider.
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
  authProvider: JwtAuthProvider, // Optional. @Injectable() class implementing McpAuthProvider.
});
```

## Authentication

Authentication works at three layers:

### Transport-level authentication

Standard NestJS middleware handles transport-level auth (validating tokens, rejecting unauthenticated requests):

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

### Auth provider (centralized auth enrichment)

The `authProvider` config option registers a centralized auth provider that runs before guards on every tool execution. It receives the raw `authInfo` from the transport and can validate tokens, decode JWTs, hydrate user context, or reject unauthenticated requests — all in one place, with full access to NestJS DI.

Implement `McpAuthProvider` as an `@Injectable()` service:

```typescript
import { Injectable } from '@nestjs/common';
import { McpAuthProvider, McpAuthInfo } from '@onivoro/server-mcp';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';

@Injectable()
export class JwtAuthProvider implements McpAuthProvider {
  constructor(
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
  ) {}

  async resolveAuth(authInfo: McpAuthInfo | undefined) {
    if (!authInfo) return undefined;

    const decoded = await this.jwtService.verifyAsync(authInfo.token);
    const user = await this.usersService.findById(decoded.sub);

    return {
      ...authInfo,
      extra: {
        userId: user.id,
        roles: user.roles,
        organizationId: user.organizationId,
      },
    };
  }
}
```

Then pass the class to the module config:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authProvider: JwtAuthProvider,
})
```

The module automatically includes the class in its providers and resolves it through `ModuleRef`, so it can inject any NestJS service. This follows the same DI pattern as guards.

**What the auth provider can do:**

| Action | How | Effect |
|--------|-----|--------|
| **Enrich** | Return a new `McpAuthInfo` with extra claims | Guards and handlers receive the enriched auth |
| **Reject** | Throw an error | Execution stops before guards run |
| **Clear** | Return `undefined` | Guards and handlers receive no auth (anonymous) |
| **Pass through** | Return the input unchanged | Same as no provider |

**Why use an auth provider instead of a guard?** Guards return `boolean` — they can approve or deny, but cannot modify the auth context. An auth provider transforms `authInfo` before any guards see it. This means you decode a JWT once centrally, and all guards receive the decoded claims without each needing to parse the token independently.

### Tool-level authorization

When the MCP SDK's OAuth 2.1 flow is in use, `authInfo` (token, clientId, scopes) flows from the transport through the auth provider (if configured), then to guards and tool handlers. Use `@McpGuard` for declarative per-tool scope checks:

```typescript
@McpTool({ name: 'read-data', description: 'Read data', schema })
@McpGuard(McpScopeGuard, { scopes: ['read'] })
async readData(params: z.infer<typeof schema>) { ... }

@McpTool({ name: 'delete-data', description: 'Delete data', schema })
@McpGuard(McpScopeGuard, { scopes: ['admin'] })
async deleteData(params: z.infer<typeof schema>) { ... }
```

For custom authorization logic beyond scope checking, implement a `McpCanActivate` guard — see [Guards](#guards).

## DNS rebinding protection

The MCP spec (2025-03-26+) recommends that Streamable HTTP servers validate the `Origin` header to prevent DNS rebinding attacks — where a malicious website makes requests to a locally-running MCP server from the browser.

Enable it by setting `allowedOrigins` in the HTTP module config:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  allowedOrigins: ['http://localhost:3000', 'https://my-app.example.com'],
});
```

When `allowedOrigins` is set:
- Requests **with** an `Origin` header not in the list are rejected with `403 Forbidden`.
- Requests **without** an `Origin` header are always allowed — non-browser MCP clients (Claude Desktop, Claude Code, curl, MCP Inspector) don't send `Origin`.
- When not set, Origin validation is disabled (backward-compatible default).

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

#### Resumability

MCP clients can reconnect after a network drop and resume their SSE stream from where they left off. This requires an `EventStore` implementation that persists outgoing events so they can be replayed on reconnect.

```typescript
import { EventStore } from '@onivoro/server-mcp';

// In-memory store for development (events are lost on restart)
const eventStore: EventStore = {
  events: new Map(),
  async storeEvent(streamId, message) {
    const id = `${streamId}-${Date.now()}`;
    this.events.set(id, { streamId, message });
    return id;
  },
  async replayEventsAfter(lastEventId, { send }) {
    let replaying = false;
    let streamId = '';
    for (const [id, { streamId: sid, message }] of this.events) {
      if (id === lastEventId) { replaying = true; streamId = sid; continue; }
      if (replaying) await send(id, message);
    }
    return streamId;
  },
};

McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  eventStore,                   // Enable resumability
  enableJsonResponse: false,    // Use SSE streams (required for resumability)
});
```

For production, implement `EventStore` with a persistent backend (Redis, database). The `enableJsonResponse` option should be set to `false` when using resumability, since JSON responses are not streamable.

Additional transport options:

| Option | Default | Description |
|--------|---------|-------------|
| `eventStore` | `undefined` | Event store for SSE resumability |
| `enableJsonResponse` | `true` | Return JSON instead of SSE streams |
| `sessionIdGenerator` | `crypto.randomUUID()` | Custom session ID generator. Set to `undefined` for stateless mode |

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
McpToolResult                // { content: McpContentBlock[], structuredContent?, isError?, _meta? }
McpContentBlock              // Union of all MCP content types
McpTextContent               // { type: 'text', text, annotations? }
McpImageContent              // { type: 'image', data, mimeType, annotations? }
McpAudioContent              // { type: 'audio', data, mimeType, annotations? }
McpEmbeddedResource          // { type: 'resource', resource: { uri, text?, blob? }, annotations? }
McpResourceLink              // { type: 'resource_link', uri, name, mimeType?, annotations? }
McpResourceContents          // { uri, mimeType?, text?, blob?, _meta? }
McpResourceResult            // { contents: McpResourceContents[], _meta? }
McpPromptMessage             // { role: 'user' | 'assistant', content: McpContentBlock }
McpPromptResult              // { description?, messages: McpPromptMessage[], _meta? }

// Auth & execution context
McpAuthInfo                  // { token, clientId, scopes, expiresAt?, resource?, extra? }
McpAuthProvider              // Interface — resolveAuth(authInfo?) for centralized auth validation and enrichment
McpToolContext               // { toolName, params, metadata, authInfo?, sessionId?, signal?, sendProgress? }
McpLogLevel                  // 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'

// Guards
McpGuard                     // Method decorator — @McpGuard(GuardClass, config?)
McpCanActivate               // Interface for custom guard classes
McpGuardMetadata             // { guardClass, config? }
McpScopeGuard                // Built-in guard — checks authInfo.scopes against required scopes

// Interceptors
McpToolInterceptor           // Interface — intercept(context, next) onion-model wrapping

// Registration change events
McpRegistrationChangeType    // 'tool' | 'resource' | 'prompt'
McpRegistrationChangeListener // (type, name) => void — callback for dynamic registration
McpResourceUpdateListener    // (uri: string) => void — callback for resource update notifications

// Decorators
McpTool                      // Method decorator for tools (schema: z.ZodObject)
McpResource                  // Method decorator for resources
McpPrompt                    // Method decorator for prompts

// Schema converters
mcpSchemaToJsonSchema        // z.ZodObject → JSON Schema object (via zod v4 native z.toJSONSchema)

// Wiring helpers
wireRegistryToServer         // Register all entries onto McpServer + subscribe to future changes; returns unsubscribe fn
buildCapabilities            // Build MCP capabilities object from current registry state
wrapResourceResult           // Auto-wrap raw handler return → McpResourceResult
wrapPromptResult             // Auto-wrap raw handler return → McpPromptResult

// SDK re-exports (types)
EventStore                   // Interface for SSE resumability event storage
StreamId                     // String alias for stream identifiers
EventId                      // String alias for event identifiers

// Interfaces
McpModuleConfig              // Configuration for McpHttpModule.registerAndServeHttp()
McpModuleAsyncOptions        // Async configuration for McpHttpModule.registerAndServeHttp()
McpStdioConfig               // Configuration for McpStdioModule.registerAndServeStdio()
McpStdioAsyncOptions         // Async configuration for McpStdioModule.registerAndServeStdio()
McpServerMetadata            // { name, version, description? }
McpToolMetadata              // { name, description, title?, schema?, outputSchema?, aliases?, annotations?, icons? }
McpToolAnnotations           // { readOnlyHint?, destructiveHint?, idempotentHint?, openWorldHint? }
McpIcon                      // { url: string, mediaType?, size? } — icon for tools/resources/prompts
McpResourceMetadata          // { name, uri, title?, description?, mimeType?, size?, icons?, annotations?, isTemplate?, listProvider?, completeProvider? }
McpResourceAnnotations       // { audience?, priority? } — annotations for resources
McpPromptMetadata            // { name, title?, description?, argsSchema?, icons?, completeProvider? }

// Provider interfaces
McpResourceListProvider      // Interface — list() for resource template list callbacks
McpCompletionProvider        // Interface — complete(argName, value, context?) for completion callbacks

// Service
McpHttpService                   // HTTP session manager (rarely needed directly)

// Constants
MCP_MODULE_CONFIG            // DI token for McpHttpModule config
MCP_STDIO_CONFIG             // DI token for McpStdioModule config
MCP_TOOL_METADATA            // Reflect metadata key
MCP_RESOURCE_METADATA        // Reflect metadata key
MCP_PROMPT_METADATA          // Reflect metadata key
MCP_GUARD_METADATA           // Reflect metadata key for @McpGuard
MCP_CORS_METHODS             // CORS methods array
MCP_CORS_ALLOWED_HEADERS     // CORS allowed headers array
MCP_CORS_EXPOSED_HEADERS     // CORS exposed headers array
MCP_CORS_CONFIG              // Complete CORS config object (methods, allowedHeaders, exposedHeaders)
```

## Companion libraries

| Library | Purpose |
|---------|---------|
| [`@onivoro/server-mcp-llm-adapter`](https://www.npmjs.com/package/@onivoro/server-mcp-llm-adapter) | Generic LLM adapter — Bedrock Converse, OpenAI, Anthropic, Gemini, Mistral |
| [`@onivoro/server-mcp-auth`](https://www.npmjs.com/package/@onivoro/server-mcp-auth) | Resource server auth — JWT validation, JWKS, scope auto-discovery, RFC 9728 Protected Resource Metadata |
| [`@onivoro/server-mcp-oauth`](https://www.npmjs.com/package/@onivoro/server-mcp-oauth) | Embedded OAuth 2.1 authorization server — wraps SDK's `OAuthServerProvider` + `mcpAuthRouter` into NestJS |

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

It also gives you a natural place to use the more advanced parts of the MCP spec — progress reporting, cancellation, session tracking — without polluting business logic with MCP-specific concerns. When `@McpTool` is bolted directly onto an existing service method, that method's signature can't change to accept `McpToolContext` without affecting all its other callers (unless you make it an optional last parameter but this still dirties your pure business logic with MCP specifics). A dedicated adapter method owns the MCP surface area and can freely use the full context:

```typescript
// libs/server/emojeez — business logic (no MCP dependency)
@Injectable()
export class EmojiService {
  async insertEmojis(params: z.infer<typeof insertEmojisSchema>): Promise<InsertEmojisResult> {
    // ... returns { enhancedText, intensity, emoji_style }
  }
}

// libs/mcp/emojeez — MCP adapter (owns the MCP surface area)
@Injectable()
export class EmojiToolService {
  constructor(private readonly emoji: EmojiService) {}

  @McpTool({ name: 'insert-emojis', description: 'Insert emojis into text', schema: insertEmojisSchema })
  async insertEmojis(
    params: z.infer<typeof insertEmojisSchema>,
    context?: McpToolContext,
  ) {
    const result = await this.emoji.insertEmojis(params);

    // Progress, cancellation, session tracking — all available here
    // without changing the business logic layer
    await context?.sendProgress?.(1, 1, 'Emojis inserted');

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
