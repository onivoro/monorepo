# @onivoro/server-mcp

A NestJS library for building transport-agnostic MCP tool services. Define tools once with decorators, consume them over HTTP, stdio, or directly via the registry. The documentation and examples generally focus on enterprise monorepos but can be easily adapted to single apps.

## Start here

Use this package if you need:

- a plain MCP HTTP or stdio server
- a shared NestJS registry for tools, prompts, and resources
- a protected MCP HTTP route when combined with an auth strategy

If you are choosing between the `@onivoro/server-mcp*` packages, start with the shared guide:
[MCP Server Package Guide](https://github.com/onivoro/monorepo/blob/main/libs/server/mcp-package-guide.md)

## What this package does

- discovers `@McpTool`, `@McpResource`, and `@McpPrompt` methods from the Nest container
- exposes them over Streamable HTTP, stdio, or direct in-process registry access
- handles MCP session lifecycle, schema conversion, registry wiring, and capability generation
- can issue HTTP bearer challenges on the configured MCP HTTP route when `requireBearerAuth` is enabled and `authStrategy` names a provider that implements the SDK's `OAuthTokenVerifier` (without an `authStrategy`, `requireBearerAuth` is ignored)

## What this package does not do

- validate JWTs by itself
- publish OAuth authorization-server endpoints by itself
- require authentication unless you configure it to do so

## Why this library exists

MCP tools are business logic with a protocol wrapper. The problem is that the same tools often need to be consumed in multiple contexts: an MCP HTTP server for Claude Desktop, a stdio process for a VS Code extension, a direct function call from a test or CLI. Without a shared registry, you end up duplicating tool definitions, schemas, and dispatch logic for each transport.

This library solves that by separating **tool definition** (decorators on NestJS services) from **tool consumption** (HTTP sessions, stdio, raw execution). You write your tools once. The registry handles discovery, schema conversion, and per-consumer format wrapping automatically.

Consumer-specific formatting (e.g. Bedrock Converse tool definitions, OpenAI function calling, Anthropic Messages API) lives in a separate adapter library that layers on top of the registry. See [`@onivoro/server-mcp-llm-adapter`](https://www.npmjs.com/package/@onivoro/server-mcp-llm-adapter) for the generic LLM adapter.

### Design goals

- **Consistency**: Teams working across an enterprise monorepo — or across separate repos entirely — get the same decorator API, the same registry behavior, and the same module patterns. A tool defined in one repo looks and works identically to a tool defined in another.
- **Flexibility**: The library bolts onto existing NestJS services just as easily as it structures dedicated MCP libraries. Import a module, add a decorator, and an existing service gains MCP capabilities without restructuring.
- **DRYness**: Tool definitions, schemas, and execution logic are defined once and consumed everywhere. Schemas live in a single source of truth (a Zod object in the business logic layer), and _optionally defined_ shared MCP adapter libraries (`libs/mcp/{domain}`) let multiple apps serve the same tools without duplication. The tool manifest is composed dynamically from decorated methods at startup — there is no separate manifest file to maintain or keep in sync.
- **Modularity**: Each concern — transport, registry, consumer-specific formatting — is a separate module. You compose only what you need. An app that talks to Bedrock directly never imports HTTP session management; an MCP HTTP server never imports Bedrock name sanitization. The decorator approach and auto-discovery also allows a single (or multiple) MCP servers to be composed from reusable business logic libraries or resusable dedicated MCP libraries.

### What you get

- **Write once, consume anywhere**: `@McpTool` services work over MCP HTTP, MCP stdio, or direct programmatic access without code changes.
- **Type-safe schemas**: `@McpTool` accepts `z.ZodObject`, enabling `z.infer<typeof schema>` for compile-time type safety on tool parameters.
- **Automatic format wrapping**: The registry provides per-consumer execution methods. Your service methods return whatever is natural — the registry wraps for the target transport.
- **Schema conversion**: Zod schemas on decorators are converted to JSON Schema automatically via zod v4's native `z.toJSONSchema()`.
- **Consistent infrastructure**: Sessions, transport, discovery, cleanup, duplicate detection, error handling — all handled.
- **Auth-aware execution**: MCP SDK `authInfo`, `era`, `sessionId`, `signal` (AbortSignal), `sendProgress` and `inputResponses` flow through the registry to tool handlers. Centralized auth enrichment via `McpAuthStrategy`, per-tool authorization via `@McpGuard`.
- **Extensible execution pipeline**: Guards, interceptors, and the handler compose in the same order as the NestJS HTTP lifecycle. Interceptors use the `intercept(context, next)` onion model.

## Three entry points

| Module                                   | Transport            | Use case                                                                     |
| ---------------------------------------- | -------------------- | ---------------------------------------------------------------------------- |
| `McpHttpModule.registerAndServeHttp()`   | Streamable HTTP      | MCP clients over network (Claude Desktop remote, MCP Inspector, web clients) |
| `McpStdioModule.registerAndServeStdio()` | Stdio (stdin/stdout) | MCP clients via subprocess (Claude Desktop local, `npx`-style servers)       |
| `McpRegistryModule.registerOnly()`       | None                 | In-process consumption (Bedrock via adapter, direct calls, tests)            |

All three modules auto-discover `@McpTool`, `@McpResource`, and `@McpPrompt` decorated methods from all providers in the NestJS module tree.

## Client compatibility

This library supports **stdio** and **Streamable HTTP**, on version 2 of the MCP TypeScript SDK (`@modelcontextprotocol/server`). It does **not** support the legacy SSE transport (`GET /sse` + `POST /messages`) by design. Consumers that don't fully support the standard right now (see table below) will eventually catch up.

Both transports serve both generations of the protocol at once, on the same endpoint:

- **Spec revision 2026-07-28** (`era: 'modern'`): stateless. There is no `initialize` handshake and no session; every request carries the client's protocol version and capabilities. Clients learn about changes on `subscriptions/listen` streams, and a tool asks the user for input by returning `inputRequired(...)` instead of sending requests to the client.
- **Revisions 2025-11-25 and earlier** (`era: 'legacy'`, back to 2024-10-07): the `initialize` handshake, optional sessions (`Mcp-Session-Id`), and server-to-client requests.

The SDK tells the two apart from each request, and tool handlers see which one they serve in `context.era`. Write tools once: `inputRequired(...)` reaches clients of both eras (see [Asking the user for input](#asking-the-user-for-input)).

| Client                 | stdio | Streamable HTTP | Status                                                     |
| ---------------------- | :---: | :-------------: | ---------------------------------------------------------- |
| Claude Desktop         |   Y   |        Y        | Full support                                               |
| Claude Code (CLI)      |   Y   |        Y        | Full support                                               |
| Cursor                 |   Y   |        Y        | Full support                                               |
| Windsurf (Codeium)     |   Y   |        Y        | Full support                                               |
| VS Code Copilot        |   Y   |        Y        | Full support (GA since VS Code 1.102)                      |
| Continue.dev           |   Y   |        Y        | Full support                                               |
| JetBrains AI Assistant |   Y   |        Y        | Full support (2025.2+)                                     |
| Roo Code               |   Y   |        Y        | Full support (v3.19.2+)                                    |
| MCP Inspector          |   Y   |        Y        | Full support                                               |
| Zed                    |   Y   |        -        | stdio only — use `mcp-remote` to bridge to HTTP servers    |
| Amazon Q Developer     |   Y   |        ~        | stdio works; Streamable HTTP has known bugs                |
| Cline                  |   Y   |        ~        | stdio works; Streamable HTTP nominally supported but buggy |

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

The MCP endpoint is available at `POST /mcp` by default. If the host app uses a Nest global prefix such as `app.setGlobalPrefix('api')`, the same module route is served at `/api/mcp`. Tools are discovered and registered automatically.

### Standalone vs bolted-on HTTP servers

Use the same module API for a dedicated MCP service and for adding MCP to an existing NestJS HTTP app. The `route` option is relative to the Nest app route space, not an absolute public URL.

| App shape                                      | Config                  | Public endpoint     |
| ---------------------------------------------- | ----------------------- | ------------------- |
| Dedicated MCP app                              | route omitted           | `/mcp`              |
| Dedicated MCP app                              | `route: 'internal/mcp'` | `/internal/mcp`     |
| Existing app with `app.setGlobalPrefix('api')` | route omitted           | `/api/mcp`          |
| Existing app with `app.setGlobalPrefix('api')` | `route: 'internal/mcp'` | `/api/internal/mcp` |

For protected HTTP servers, `resourceServerUrl` in `@onivoro/server-mcp-auth` must match the public endpoint clients call, including any global prefix, reverse-proxy base path, or custom route.

### Canonical protected HTTP example

For a protected MCP HTTP route, combine this package with `@onivoro/server-mcp-auth`:

```typescript
import { Module } from '@nestjs/common';
import { McpHttpModule } from '@onivoro/server-mcp';
import { McpAuthModule, McpJwtAuthStrategy } from '@onivoro/server-mcp-auth';
import { EmojiService } from './services/emoji.service';

@Module({
  imports: [
    McpAuthModule.configureJwt({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      issuer: 'https://auth.example.com',
      audience: 'https://api.example.com/mcp',
      resourceServerUrl: 'https://api.example.com/mcp',
    }),
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-mcp-server', version: '1.0.0' },
      authStrategy: McpJwtAuthStrategy,
      requireBearerAuth: true,
    }),
  ],
  providers: [EmojiService],
})
export class AppModule {}
```

### Platform requirement

`McpHttpModule` requires NestJS's Express platform (`@nestjs/platform-express`), which is the default when you call `NestFactory.create()`. It depends on Express body-parsing middleware to parse incoming request bodies.

If your application uses `@nestjs/platform-fastify`, use `McpRegistryModule.registerOnly()` and write a Fastify-aware controller around `McpHttpService`, which isn't provided by `registerOnly()`: provide it yourself, along with `MCP_MODULE_CONFIG` (an `McpModuleConfig`). `McpHttpService.handleRequest(req, res)` takes raw Node `http.IncomingMessage` and `http.ServerResponse` (`request.raw`, `reply.raw`) and reads the parsed JSON body from `req.body`, so set that from Fastify's parsed body first. Bearer authentication and the auth strategy are set up by `McpHttpModule`; without it, call `httpService.setBearerAuthVerifier(...)` and `registry.setAuthStrategy(...)` yourself. Or serve the registry with the SDK directly (see [Custom transport](#custom-transport)).

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
import { McpStderrLogger } from '@onivoro/server-mcp';
import { AppStdioModule } from './app/app-stdio.module';

async function bootstrap() {
  await NestFactory.createApplicationContext(AppStdioModule, {
    logger: new McpStderrLogger(),
  });
  // No HTTP listener — the module connects to stdin/stdout on init
}
bootstrap();
```

The server starts listening on stdin/stdout as soon as the NestJS application context initializes. Tools, resources, and prompts are discovered and registered automatically.

It serves either protocol era (or only the 2025-era one with `protocolNegotiation: 'legacy'`; see [Custom capabilities and notifications](#custom-capabilities-and-notifications)). The client's first message decides which: `server/discover` (or any 2026-07-28 request) for the modern protocol, `initialize` for 2025-era clients. Either way the connection is long-lived, so tools registered later, `setToolEnabled` and `notifyResourceUpdated` reach the client: as unsolicited notifications on a 2025-era connection, and on the client's `subscriptions/listen` streams on a 2026-07-28 one.

### Logging goes to stderr

stdout carries the JSON-RPC stream, and Nest's default logger writes everything below `error` to stdout, which corrupts it. `McpStderrLogger` is a `ConsoleLogger` that writes every level to stderr.

When it serves on `process.stdout`, `registerAndServeStdio()` installs it as Nest's logger (`Logger.overrideLogger`) as soon as the module is declared, before Nest bootstraps. That covers Nest's startup logs, the module's own logs and your services' `Logger` calls. A `logger` passed to `NestFactory` replaces it, so if you pass one, make it `McpStderrLogger` (as above) or another logger that writes to stderr.

`redirectLogsToStderr` controls this. It defaults to `true`, or `false` when you pass a custom `stdout`. Set it to `false` to keep your own logger setup. `registerAndServeStdioAsync()` takes `redirectLogsToStderr` in its options rather than in the factory's config, because it must apply before Nest bootstraps; there it defaults to `true`.

Never write to stdout yourself (`console.log`, `process.stdout.write`) in a stdio server.

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

// Feed it newline-delimited JSON-RPC; a real client starts with `initialize` or `server/discover`
stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'initialize', id: 1, params: { protocolVersion: '2025-11-25', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } } }) + '\n');
```

### Custom capabilities and notifications

A stdio server can advertise capabilities of its own and send the client notifications from application code. A [Claude Code channel](https://code.claude.com/docs/en/channels-reference) needs both: the `experimental['claude/channel']` capability, and a `notifications/claude/channel` notification for each event it pushes into the session.

```typescript
// app-stdio.module.ts
@Module({
  imports: [
    McpStdioModule.registerAndServeStdio({
      metadata: {
        name: 'builds',
        version: '1.0.0',
        // Claude Code gives Claude these as context when the server connects.
        instructions: 'Build events arrive as <channel source="builds" ...>. Read them and act; no reply is expected.',
      },
      capabilities: { experimental: { 'claude/channel': {} } },
      // Claude Code doesn't register a channel that negotiates 2026-07-28.
      protocolNegotiation: 'legacy',
    }),
  ],
  providers: [BuildEventsService],
})
export class AppStdioModule {}
```

```typescript
// build-events.service.ts
import { Injectable } from '@nestjs/common';
import { McpStdioService } from '@onivoro/server-mcp';

@Injectable()
export class BuildEventsService {
  constructor(private readonly stdio: McpStdioService) {}

  async onBuildFailed(branch: string, runId: string) {
    await this.stdio.sendNotification('notifications/claude/channel', {
      content: `build failed on ${branch}`,
      meta: { severity: 'high', run_id: runId }, // each key becomes an attribute of the <channel> tag
    });
  }
}
```

- `capabilities` adds capabilities next to the ones the module builds from the registry. The keys the module builds (`logging`, `tools`, `resources`, `prompts`) are not part of its type (`McpExtraCapabilities`) and are ignored, with a warning at startup, if passed anyway: the module sends the notifications those keys promise whatever they say, so a caller's `tools: { listChanged: false }` would be a false claim. Advertise only what your server handles.
- `McpStdioService` is provided and exported by `McpStdioModule`. `sendNotification(method, params?)` sends any notification outside a request and resolves `true` once it is written to the transport (not when the client has processed it). It never rejects: it resolves `false`, sending nothing, until the connection is ready and after it has closed, and also when the SDK or the transport refuses the message (logged as a warning). Nothing is queued.
- The connection is ready once it has settled on an era. A client can probe with `server/discover` and then fall back to `initialize`, so the probe alone doesn't count: a 2025-era connection is ready when the client has sent `notifications/initialized`, and a 2026-07-28 one when the server has accepted a request of that era other than `server/discover`, such as `tools/list` or `subscriptions/listen` (a request claiming a revision the server doesn't support is refused and doesn't count). `await stdio.whenConnected()` before an event that must not be dropped. It rejects with `McpStdioClosedError` once the connection has closed (the client went away, or the module shut down), and with the signal's reason if you pass an `AbortSignal` that aborts first. `isConnected()` and `getProtocolEra()` report the connection.
- `protocolNegotiation: 'legacy'` serves only the 2025-era protocol: the module connects one server to the transport directly, so a client that probes with `server/discover` falls back to `initialize`. The default, `'auto'`, serves both eras. A channel needs `'legacy'`. Claude Code's [MCP page, "Push messages with channels"](https://code.claude.com/docs/en/mcp#push-messages-with-channels) says: "On the v2 runtime, a channel server that negotiates MCP protocol revision 2026-07-28 can't deliver channel messages, so Claude Code doesn't register it as a channel. A channel server that doesn't support that revision connects on the earlier handshake and registers as before. Claude Code asks stdio servers for that revision by default. To keep a stdio channel server on the earlier handshake, set `MCP_PROTOCOL_NEGOTIATION` to `legacy`, which keeps every server on it." `'legacy'` makes the server one that doesn't support that revision, without asking each user to set that variable.
- `onServerCreated(server, { era })` receives each `McpServer` the module builds, wired to the registry and not yet connected, for anything else the SDK offers, such as handling a notification from the client. It runs before the module sets the server's `onclose`; if you set the SDK's single-slot callbacks (`onclose`, `onerror`, `oninitialized`), chain them (call the one that was there) rather than replacing them. If the hook throws, the server is dropped and the error propagates: with `'legacy'` the module fails to start; with `'auto'` the client's request gets an internal error. A channel that relays permission prompts declares `experimental['claude/channel/permission']` and handles Claude Code's requests:

  ```typescript
  onServerCreated: (server) =>
    server.server.setNotificationHandler(
      'notifications/claude/channel/permission_request',
      { params: z.object({ request_id: z.string(), tool_name: z.string(), description: z.string(), input_preview: z.string() }) },
      (params) => relay.forward(params),
    ),
  ```

  With `protocolNegotiation: 'auto'` the SDK may build a server only to answer a `server/discover` probe and then discard it, so the hook can run more than once.

`McpHttpModule` takes the same `capabilities` option, with the same reserved keys. It has no `McpStdioService` counterpart: a stateless HTTP server has no connection to send on outside a request.

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
    McpLlmAdapterModule.forBedrockConverse(), // or forOpenAi(), forClaude(), etc.
  ],
  providers: [EmojiService, ChatService],
})
export class AppModule {}
```

See [`@onivoro/server-mcp-llm-adapter`](https://www.npmjs.com/package/@onivoro/server-mcp-llm-adapter) for provider-specific usage.

### Custom transport

`registerOnly()` also works when you need to serve the registry yourself — another framework's HTTP stack, a WebSocket, or any other transport. The registry populates during module init; you then wire it onto `McpServer` instances from `@modelcontextprotocol/server`.

A server connected to a transport with `server.connect(transport)` speaks the 2025-era protocol:

```typescript
import { Injectable, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import type { Transport } from '@modelcontextprotocol/server';
import { McpToolRegistry, wireRegistryToServer, buildCapabilities } from '@onivoro/server-mcp';

@Injectable()
export class CustomTransportService implements OnApplicationBootstrap, OnModuleDestroy {
  private server?: McpServer;
  private unsubscribe?: () => void;

  constructor(private readonly registry: McpToolRegistry) {}

  // Runs after every module's onModuleInit, so discovery has populated the registry.
  onApplicationBootstrap() {
    this.server = new McpServer({ name: 'my-server', version: '1.0.0' }, { capabilities: buildCapabilities(this.registry) });

    // Wires existing entries and follows future registrations, before connecting.
    // Returns a function that stops following the registry.
    this.unsubscribe = wireRegistryToServer(this.registry, this.server);
  }

  async connect(transport: Transport) {
    await this.server!.connect(transport);
  }

  async onModuleDestroy() {
    this.unsubscribe?.();
    await this.server?.close();
  }
}
```

To serve 2026-07-28 clients over HTTP yourself, give the SDK's `createMcpHandler` a factory that builds a server per request, and publish registry changes through the handler (this is what `McpHttpModule` does for them):

```typescript
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import { buildCapabilities, wireRegistryToServer } from '@onivoro/server-mcp';

const handler = createMcpHandler(
  () => {
    const server = new McpServer({ name: 'my-server', version: '1.0.0' }, { capabilities: buildCapabilities(registry) });
    // Lives for one request: no need to follow the registry.
    wireRegistryToServer(registry, server, { era: 'modern', followRegistry: false });
    return server;
  },
  // This handler only serves 2026-07-28 clients; serve 2025-era ones some other way.
  { legacy: 'reject' },
);
registry.onRegistrationChange((type) => (type === 'tool' ? handler.notify.toolsChanged() : type === 'prompt' ? handler.notify.promptsChanged() : handler.notify.resourcesChanged()));
registry.setToolEnabledDelegate(() => handler.notify.toolsChanged()); // also lets setToolEnabled() work
registry.onResourceUpdate((uri) => handler.notify.resourceUpdated(uri));
// Serve with handler.fetch(request, { authInfo }), or toNodeHandler(handler) from @modelcontextprotocol/node.
```

Without `legacy: 'reject'`, the handler also answers 2025-era clients, one server per request (as `McpHttpModule` does in stateless mode); wire with `era: ctx.era` and `unsolicitedMessages: ctx.era === 'modern'`, from the factory's `ctx` (a per-request 2025-era server has no stream for notifications). `McpHttpService` shows the full composition: `isLegacyRequest()` sends 2025-era requests to a session-aware transport and the rest to the handler.

To hide tools per caller on a custom transport, set the rules with `registry.setToolVisibility({ toolVisibility, toolFilter })` (the modules do this from their options), and build each caller's server with them. `resolveVisibleTools` returns `undefined` when no rules are set, which means every tool. Pass auth that arrived over a transport as a copy, so a marked object is never trusted by accident:

```typescript
const handler = createMcpHandler(async (ctx) => {
  const visibleTools = await registry.resolveVisibleTools(ctx.authInfo && { ...ctx.authInfo });
  const server = new McpServer({ name: 'my-server', version: '1.0.0' }, { capabilities: buildCapabilities(registry) });
  wireRegistryToServer(registry, server, { era: 'modern', followRegistry: false, visibleTools });
  return server;
});
```

Keep `buildCapabilities(registry)` (or advertise `tools` yourself): a caller who sees no tools still needs a `tools/list` that answers with an empty list.

For stdio on custom streams, `serveStdio(factory, { transport })` from `@modelcontextprotocol/server/stdio` serves both eras; build the server in the factory with `wireRegistryToServer(registry, server, { era: ctx.era })`, and call the function it returns when the server closes (the SDK may build and discard an extra server to answer a `server/discover` probe).

`buildCapabilities(registry, options?)` derives capabilities from the current registry state. Because it reads the registry at call time, call it after discovery has run. It returns:

- `logging: {}`, unless you pass `{ logging: false }`.
- `tools: { listChanged }` when at least one tool is registered.
- `resources: { subscribe, listChanged }` when at least one resource is registered.
- `prompts: { listChanged }` when at least one prompt is registered.

`listChanged` and `subscribe` are `true` unless you pass `{ notifications: false }`.

`wireRegistryToServer(registry, server, options?)` takes:

| Option                  | Default    | Meaning                                                                                                                                                                                                                                    |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `requestScopedMessages` | `true`     | The transport delivers messages tied to a request: progress, logs, and 2025-era server-to-client requests. True for stdio and SSE responses; false for JSON responses. Use the same value as `buildCapabilities`' `logging`.               |
| `unsolicitedMessages`   | `true`     | List-changed and resource-updated notifications can reach the client. Use the same value as `buildCapabilities`' `notifications`.                                                                                                          |
| `era`                   | `'legacy'` | The protocol era the server serves. `'modern'` servers get no `createMessage`, `elicitInput` or `listRoots` in the tool context (2026-07-28 has no server-to-client requests).                                                             |
| `followRegistry`        | `true`     | Keep the server in step with the registry: wire tools, resources and prompts registered later, apply `setToolEnabled`, and forward `notifyResourceUpdated`. Turn off for a server that lives for one request.                              |
| `visibleTools`          | every tool | The tools the server's caller may see, from `await registry.resolveVisibleTools(authInfo)`. Others aren't registered on the server, so they're neither listed nor callable. See [Per-caller tool visibility](#per-caller-tool-visibility). |

With `requestScopedMessages: false`, tool handlers get no `sendProgress`, `sendLog`, `createMessage`, `elicitInput` or `listRoots`. With `unsolicitedMessages: false`, `wireRegistryToServer` advertises `listChanged: false` and `subscribe: false` (the SDK would otherwise advertise `listChanged: true` for every kind it serves) and doesn't handle `resources/subscribe`. Capabilities can only change before the server connects, so call `wireRegistryToServer` first.

While following the registry, tools/resources/prompts added after startup are wired to the server (and the SDK sends `listChanged` notifications). On a 2025-era server with `unsolicitedMessages` on, it also handles `resources/subscribe` / `resources/unsubscribe` and forwards `notifyResourceUpdated(uri)` to a client that subscribed to that URI; on a 2026-07-28 server it forwards every update, and the SDK delivers it to listen streams whose filter names the URI. Log levels are the SDK's: `logging/setLevel` on 2025-era connections, the request's own level on 2026-07-28 ones. It returns a function that stops following the registry; call it when the server closes. The function also has `setVisibleTools(visibleTools)`, which changes which tools the server's caller sees (for a long-lived server whose caller's auth changed): tools that became visible are registered, ones that no longer are are removed (the SDK sends `tools/list_changed` for each), and later registrations and `setToolEnabled` follow the new set. `McpHttpModule` uses it when a stateful session's token changes. To add capabilities beyond what the registry provides (e.g. `experimental`), pass them as `extra` (the keys `buildCapabilities` builds are ignored there):

```typescript
const capabilities = buildCapabilities(this.registry, { extra: { experimental: { 'example/feature': {} } } });
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
    aliases: { 'bedrock-converse': 'insert_emojis' }, // explicit alias for consumer libraries (optional)
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
  aliases: { 'bedrock-converse': 'insert_emojis' },
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
  async importData(params: z.infer<typeof importSchema>, context?: McpToolContext) {
    const rows = await this.fetchRows(params.url);

    for (let i = 0; i < rows.length; i++) {
      await this.processRow(rows[i]);
      await context?.sendProgress?.(i + 1, rows.length, `Processing row ${i + 1}`);
    }

    return `Imported ${rows.length} rows`;
  }
}
```

`sendProgress(progress, total?, message?)` sends a `notifications/progress` notification to the client, on the same response stream as the tool call's result:

| Parameter  | Type      | Description                                                      |
| ---------- | --------- | ---------------------------------------------------------------- |
| `progress` | `number`  | Current progress value. Should increase monotonically.           |
| `total`    | `number?` | Total expected value (enables percentage display in client UIs). |
| `message`  | `string?` | Human-readable description of current step.                      |

The `?.` chain on `context?.sendProgress?.()` is important — `sendProgress` is only populated when the client requested progress tracking via `_meta.progressToken` and the transport can deliver it. Clients that don't request progress (most do not by default) leave it `undefined`, and so does HTTP with `enableJsonResponse: true`, which answers with a single JSON body that has no room for progress. The optional chain makes the call a safe no-op.

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

`sessionId` is only set for 2025-era clients when the HTTP transport runs with stateful sessions (the `session` config option); each client connection then gets a unique session. 2026-07-28 has no sessions, so it is `undefined` for those clients, in stateless HTTP mode (the default), and over stdio.

`context.era` says which protocol the caller speaks: `'modern'` (2026-07-28) or `'legacy'` (2025-11-25 and earlier). It is unset when the registry is called in-process.

### Logging

Tool handlers can send structured log messages to MCP clients via `context.sendLog()`. The client controls the minimum log level, and messages below it are dropped: a 2025-era client sets it with `logging/setLevel`; a 2026-07-28 client names it on each request (`_meta["io.modelcontextprotocol/logLevel"]`), and a request that names no level gets no log messages. Like progress, log messages go out on the tool call's response stream, so `sendLog` is `undefined` (and `logging` isn't advertised) on HTTP with `enableJsonResponse: true`.

Spec revision 2026-07-28 deprecates logging to the client; it recommends stderr or OpenTelemetry for server diagnostics. `sendLog` keeps working for clients that ask for it.

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

How clients subscribe depends on their protocol era, and `notifyResourceUpdated(uri)` reaches both:

- **2025-era clients** send `resources/subscribe` and `resources/unsubscribe`, which the library handles, tracking subscribers by session ID (see `getResourceSubscribers(uri)`). Subscriptions are only tracked when the request carries a session ID — i.e. HTTP with `session` configured — and are cleaned up when those sessions close. The update goes only to clients that subscribed to that URI on their connection (this includes stdio clients, which have no session ID). Stateless HTTP has nowhere to send it.
- **2026-07-28 clients** open a `subscriptions/listen` stream whose filter names the URIs (and list changes) they want; the SDK serves it. The update goes to every open stream whose filter names the URI, on HTTP (stateless or not) and stdio.

### Resource template completion

Resource templates can provide autocompletion for URI variables and listing via injectable strategies. Both `listStrategy` and `completeStrategy` are resolved through NestJS DI, so they can inject any service:

```typescript
@Injectable()
export class UserListStrategy implements McpResourceListStrategy {
  constructor(private readonly userService: UserService) {}

  async list() {
    const users = await this.userService.findAll();
    return { resources: users.map(u => ({ uri: `app://users/${u.id}`, name: u.name })) };
  }
}

@Injectable()
export class UserCompleteStrategy implements McpCompletionStrategy {
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
  listStrategy: UserListStrategy,
  completeStrategy: UserCompleteStrategy,
})
async getProfile(uri: URL, variables: { userId: string }) {
  return { contents: [{ uri: uri.href, text: JSON.stringify(await this.userService.get(variables.userId)) }] };
}
```

Both strategies must be registered as NestJS providers (e.g., in the module's `providers` array or exported from an imported module).

### Output schema

Tools can declare an output schema for structured output validation. When present, the SDK validates `structuredContent` against this schema and advertises it to clients. Return a plain object and it becomes the `structuredContent`, with its JSON as the text content for clients that ignore structured output:

```typescript
const resultSchema = z.object({ count: z.number(), items: z.array(z.string()) });

@McpTool({ name: 'list-items', description: 'List all items', schema: inputSchema, outputSchema: resultSchema })
async listItems(params: z.infer<typeof inputSchema>) {
  const items = await this.itemService.list(params.filter);
  return { count: items.length, items };
}
```

To choose the text content yourself, return the full result: `{ content: [{ type: 'text', text: 'Done' }], structuredContent: { count, items } }`. A tool with an output schema must return structured content (unless the result has `isError: true`); a string result, or an array, fails the SDK's validation.

### Server instructions

Provide human-readable usage instructions, which clients receive in the `initialize` response (2025-era) or the `server/discover` result (2026-07-28):

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: {
    name: 'my-server',
    version: '1.0.0',
    instructions: 'This server provides tools for managing customer data. Use list-customers first to find IDs.',
  },
});
```

### Tool enable/disable

Tools can be enabled or disabled at runtime with `registry.setToolEnabled(name, enabled)`. Disabled tools are hidden from `tools/list` and reject calls. It throws if the tool isn't registered, or if nothing serves the registry yet: `McpHttpModule` and `McpStdioModule` count from startup, and a custom server once `wireRegistryToServer` has wired it while following the registry (the default). The toggle applies to every currently wired server, and the registry remembers it, so servers wired later (new HTTP sessions, or the per-request servers of stateless HTTP) start with the tool in that state (`registry.isToolEnabled(name)` reports it). With [per-caller tool visibility](#per-caller-tool-visibility), a disabled tool stays hidden from everyone, and enabling it shows it only to callers who may see it:

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

### Asking the user for input

A tool that needs something from the user — a confirmation, a missing value, a choice — returns `inputRequired(...)` with the requests, and reads the answers when the client calls it again:

```typescript
import { acceptedContent, inputRequired, McpTool, McpToolContext } from '@onivoro/server-mcp';

const confirmSchema = z.object({ confirm: z.boolean() });

@McpTool({ name: 'deploy', description: 'Deploy to an environment', schema: deploySchema })
async deploy(params: z.infer<typeof deploySchema>, context?: McpToolContext) {
  const answer = acceptedContent(context?.inputResponses, 'confirm', confirmSchema);
  if (!answer) {
    return inputRequired({
      inputRequests: {
        confirm: inputRequired.elicit({ message: `Deploy to ${params.env}?`, requestedSchema: confirmSchema }),
      },
    });
  }
  return answer.confirm ? this.deployer.deploy(params.env) : 'Cancelled';
}
```

The handler runs again from the top with `context.inputResponses` filled in, so keep the work before the question cheap and side-effect free.

- `inputRequired.elicit({ message, requestedSchema })` asks for a form (`requestedSchema` can be a flat zod object or a raw elicitation schema); `inputRequired.elicitUrl({ message, url })` sends the user to a URL. `inputRequired.createMessage(...)` (sampling) and `inputRequired.listRoots()` also exist, but spec 2026-07-28 deprecates both.
- `acceptedContent(responses, key, schema?)` returns the accepted, validated answer or `undefined`; `inputResponse(responses, key)` tells declined, cancelled and missing answers apart.
- To carry state between rounds, return `inputRequired({ inputRequests, requestState })` and read it with `context.requestState()`. The client echoes it back, so treat it as untrusted unless you sign it with `createRequestStateCodec`.

This works in both protocol eras:

- **2026-07-28 clients** answer the requests and retry the call themselves (multi round-trip requests). The client must have declared the capability (`elicitation`, …) in the request; otherwise the call fails.
- **2025-era clients** get real `elicitation/create` (or `sampling/createMessage`, `roots/list`) requests from the SDK, which then calls the handler again with the answers. That needs a connection the server can send requests on: stdio, or HTTP with stateful `session` and SSE responses (the default). A stateless 2025-era HTTP request gets an `isError` result instead, and with `enableJsonResponse: true` the request waits out the SDK's round timeout and fails.

Called in-process (`executeToolRaw`, `@onivoro/server-mcp-llm-adapter`), there is no client to ask: the result comes back as is, and the LLM adapter reports it as a failure.

#### Server-to-client requests (deprecated)

2025-era connections also offer the older push-style callbacks: `context.createMessage(params)` (sampling), `context.elicitInput(params)` and `context.listRoots()`. Each is set only when the client declared the capability when it initialized, the transport delivers requests sent while a tool runs, and the caller speaks the 2025-era protocol — so not for 2026-07-28 clients, stateless HTTP, or `enableJsonResponse: true`. Prefer `inputRequired(...)`, which reaches clients of both eras. When you call `executeToolRaw`/`executeToolWrapped` directly they are only present if you pass them in `extra`. Use optional chaining, and try/catch for clients that reject the request:

```typescript
@McpTool({ name: 'summarize-roots', description: 'Summarize the client workspace roots' })
async summarizeRoots(_params: Record<string, never>, context?: McpToolContext) {
  try {
    const roots = await context?.listRoots?.();
    return roots ?? 'Roots are not available';
  } catch {
    return 'Client does not support roots';
  }
}
```

### Icons

Tools, resources, and prompts can provide icons for client UI rendering (spec 2025-11-25+). An icon has a `src` (`https:` or `data:` URL) and optionally a `mimeType`, `sizes` (e.g. `['32x32']`, or `['any']` for SVG) and `theme` (`'light'` or `'dark'`):

```typescript
@McpTool({
  name: 'deploy-app',
  description: 'Deploy application',
  schema: deploySchema,
  icons: [
    { src: 'https://cdn.example.com/deploy-icon.svg', mimeType: 'image/svg+xml', sizes: ['any'] },
    { src: 'https://cdn.example.com/deploy-icon-32.png', mimeType: 'image/png', sizes: ['32x32'], theme: 'light' },
  ],
})
async deploy(params: z.infer<typeof deploySchema>) { ... }
```

Resources and prompts accept `icons` in their metadata object:

```typescript
@McpResource({
  name: 'logs',
  uri: 'app://logs',
  icons: [{ src: 'https://cdn.example.com/logs.svg' }],
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

Prompts can provide autocompletion for their arguments via an injectable `completeStrategy`:

```typescript
@Injectable()
export class LanguageCompleteStrategy implements McpCompletionStrategy {
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
  completeStrategy: LanguageCompleteStrategy,
})
async generateCode(params: { language: string; task: string }) {
  return { messages: [{ role: 'user', content: { type: 'text', text: `Write ${params.language}: ${params.task}` } }] };
}
```

### Async module configuration

When config must be resolved at runtime (e.g., from a config service, environment, or secret manager), use the async factory methods:

```typescript
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { McpHttpModule } from '@onivoro/server-mcp';

@Module({
  imports: [
    McpHttpModule.registerAndServeHttpAsync({
      route: 'mcp',
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

For HTTP async configuration, `route` is intentionally outside `useFactory` because Nest controller decorators are created before async factories resolve. Runtime values such as metadata, `allowedOrigins`/`allowedHosts`, auth strategy, and session settings belong in `useFactory` (CORS itself is set on the app, with `app.enableCors(MCP_CORS_CONFIG)`); the HTTP route must be known synchronously when the module is created.

The stdio equivalent is `McpStdioModule.registerAndServeStdioAsync()` with the same `{ imports, inject, useFactory }` shape (no `route`); its factory returns an `McpStdioConfig`.

### Input validation

When a tool has a Zod schema, the registry runs `schema.parse(params)` as the **Pipes** stage of the [execution pipeline](#execution-pipeline) — after guards but before interceptors and the handler. This means:

- **Unauthorized calls are rejected before validation** — guards run first, so invalid params never waste time parsing if the call isn't authorized.
- **Invalid params are rejected** with a `ZodError` before interceptors or the handler execute.
- **Defaults and transforms are applied** — if your schema has `.default()` or `.transform()`, interceptors and the handler receive the fully processed params, not the raw input.
- **Refinements are enforced** — `.refine()` and `.superRefine()` checks run, even though they can't be expressed in JSON Schema.

This holds on every path. Over MCP transports (HTTP/stdio) the SDK advertises the schema in `tools/list` but leaves validation to the registry, so the order above, and audit's `onRejected` hook, apply there too, and transforms run once. In-process callers (`executeToolRaw`, `executeToolForProvider` in `@onivoro/server-mcp-llm-adapter`) get the same pipeline.

Tools without a schema accept any params without validation.

### Return value handling

Your `@McpTool` methods can return any of these — the registry wraps automatically based on how the tool is consumed:

| Your method returns                                              | `executeToolRaw()` (raw) | `executeToolWrapped()` (MCP)                                      |
| ---------------------------------------------------------------- | ------------------------ | ----------------------------------------------------------------- |
| `{ content: [{ type: 'text', text: '...' }] }`                   | Passed through           | Passed through                                                    |
| `{ content: [{ type: 'image', data: '...', mimeType: '...' }] }` | Passed through           | Passed through                                                    |
| `'plain string'`                                                 | `'plain string'`         | `{ content: [{ type: 'text', text: 'plain string' }] }`           |
| `{ key: 'value' }`                                               | `{ key: 'value' }`       | `{ content: [{ type: 'text', text: '...' }] }` (JSON-stringified) |
| `{ key: 'value' }`, tool has an `outputSchema`                   | `{ key: 'value' }`       | The same, plus `structuredContent: { key: 'value' }`              |

When auto-wrapping, the result is always wrapped as `type: 'text'`. If you need to return other content types, return the full `McpToolResult` structure directly — it passes through unchanged.

#### Resource return value handling

`@McpResource` handlers benefit from the same auto-wrapping. Return a plain value and it becomes the correct `{ contents: [...] }` shape:

| Your method returns                    | What the MCP client receives                                                            |
| -------------------------------------- | --------------------------------------------------------------------------------------- |
| `{ contents: [{ uri, text: '...' }] }` | Passed through                                                                          |
| `'plain string'`                       | `{ contents: [{ uri, mimeType: 'text/plain', text: 'plain string' }] }`                 |
| `{ key: 'value' }`                     | `{ contents: [{ uri, mimeType: 'application/json', text: '...' }] }` (JSON-stringified) |

The `uri` is automatically populated from the request. When the resource metadata specifies a `mimeType`, that value is used instead of the defaults (`text/plain` for strings, `application/json` for objects). If you need to return binary content or multiple content items, return the full `McpResourceResult` structure directly.

#### Prompt return value handling

`@McpPrompt` handlers work the same way:

| Your method returns                                                        | What the MCP client receives                                                                  |
| -------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `{ messages: [{ role: 'user', content: { type: 'text', text: '...' } }] }` | Passed through                                                                                |
| `'Generate a summary'`                                                     | `{ messages: [{ role: 'user', content: { type: 'text', text: 'Generate a summary' } }] }`     |
| `{ topic: 'testing' }`                                                     | `{ messages: [{ role: 'user', content: { type: 'text', text: '...' } }] }` (JSON-stringified) |

Auto-wrapped prompts always use `role: 'user'`. If you need assistant messages, multiple messages, or non-text content, return the full `McpPromptResult` structure directly.

The wrapping functions are exported as `wrapResourceResult(raw, uri, mimeType?)` and `wrapPromptResult(raw)` for custom transports or tests:

```typescript
import { wrapPromptResult, wrapResourceResult } from '@onivoro/server-mcp';

wrapResourceResult({ debug: true }, 'app://config');
// { contents: [{ uri: 'app://config', mimeType: 'application/json', text: '{\n  "debug": true\n}' }] }
wrapPromptResult('Summarize this');
// { messages: [{ role: 'user', content: { type: 'text', text: 'Summarize this' } }] }
```

### MCP content types

The MCP spec defines five content block types for tool results:

| Type            | Interface             | Use case                                           |
| --------------- | --------------------- | -------------------------------------------------- |
| `text`          | `McpTextContent`      | Plain text or markdown                             |
| `image`         | `McpImageContent`     | Base64-encoded image (`data` + `mimeType`)         |
| `audio`         | `McpAudioContent`     | Base64-encoded audio (`data` + `mimeType`)         |
| `resource`      | `McpEmbeddedResource` | Inline resource content (`uri` + `text` or `blob`) |
| `resource_link` | `McpResourceLink`     | Link to a resource (`uri` + `name`)                |

All content blocks support optional `annotations` with `audience` (`'user'`, `'assistant'`, or both) and `priority` fields. These types are exported from the library as `McpContentBlock` (the union) and the individual interfaces.

### Aliases

Consumer-specific libraries may require different tool naming conventions. The `aliases` field accepts a `Record<string, string>` where each key is a consumer identifier:

```typescript
@McpTool({
  name: 'my-tool',
  description: 'description',
  schema: myToolSchema,
  aliases: { 'bedrock-converse': 'my_tool' },
})
```

The `aliases` field is optional. Consumer libraries read the alias key they care about (e.g. `@onivoro/server-mcp-llm-adapter` reads `aliases['bedrock-converse']` for Bedrock Converse) falling back to `name`.

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
  aliases: { 'bedrock-converse': 'delete_item' },
  annotations: { destructiveHint: true },
})
async deleteItem(params: z.infer<typeof deleteItemSchema>) { ... }
```

| Annotation        | Type      | Meaning                                                              |
| ----------------- | --------- | -------------------------------------------------------------------- |
| `readOnlyHint`    | `boolean` | Tool does not modify its environment                                 |
| `destructiveHint` | `boolean` | Tool may perform destructive updates (delete, overwrite)             |
| `idempotentHint`  | `boolean` | Repeated calls with the same args have no additional effect          |
| `openWorldHint`   | `boolean` | Tool may interact with external entities (network, third-party APIs) |

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

A static resource handler is called with `(uri, context)` and a template's with `(uri, variables, context)`. `context` is an `McpHandlerContext`, which the library owns so handlers don't change shape when the SDK does: `authInfo` (as the transport verified it), `era`, `sessionId`, `signal`, `inputResponses` and `requestState`. Resource handlers don't go through the tool pipeline (auth strategy, guards, interceptors). Like tools, they can return `inputRequired(...)`.

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

A prompt handler is called with `(args, context)`, or just `(context)` when it has no `argsSchema`; `context` is an `McpHandlerContext`, as for resources. `argsSchema` is a shape of zod fields, which the library wraps in `z.object()` for the SDK.

## Execution pipeline

The registry's tool execution pipeline is modeled after the [NestJS HTTP request lifecycle](https://docs.nestjs.com/faq/request-lifecycle). If you're familiar with how NestJS processes an HTTP request through middleware, guards, pipes, interceptors, and exception filters, the same mental model applies here — each stage has a direct analog in the MCP tool pipeline.

| Stage | NestJS HTTP       | MCP Registry                   | Responsibility                                                                                                                 |
| :---: | ----------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
|   1   | Middleware        | Transport layer                | NestJS middleware on the MCP route (authentication, logging)                                                                   |
|   2   | —                 | Auth strategy                  | Centralized auth enrichment/validation (`McpAuthStrategy.resolveAuth`); skipped for auth marked with `markMcpAuthInfoResolved` |
|   3   | Guards            | `@McpGuard`                    | Authorization — should this call proceed?                                                                                      |
|   4   | Pipes             | `schema.parse()`               | Validation and transformation of input params (internally executed based on the Zod schema)                                    |
|   5   | Interceptors      | `McpToolInterceptor` chain     | Cross-cutting concerns wrapping execution (auditing, caching, timing, transformation)                                          |
|   6   | Route handler     | Tool handler                   | Business logic (innermost `next()` of the interceptor chain)                                                                   |
|   7   | Exception filters | `executeToolWrapped` try/catch | Error wrapping for MCP clients                                                                                                 |

```
Transport middleware → Auth strategy → Guards → Validation → Interceptor₁ → ... → Handler
                                                                  ↑                    |
                                                                  |   result ←── ←────┘
                                                                  ↓
                                                   executeToolWrapped catches errors
```

Interceptors use the **onion model** — identical to NestJS `NestInterceptor`. Each interceptor's `intercept(context, next)` wraps the next interceptor in the chain; the innermost `next()` calls the tool handler. This means each interceptor can run logic both before and after the handler in a single method.

**Key behaviors at each stage:**

- **Auth strategy** (optional) runs first, transforming raw `authInfo` from the transport. All downstream stages (guards, interceptors, handler) receive the resolved auth. If the provider throws, execution stops immediately. See [Auth strategy](#auth-strategy-centralized-auth-enrichment).
- **Guards** receive raw (unvalidated) params but resolved auth. They check authorization, not input shape. If a guard rejects, validation never runs — an unauthorized caller doesn't get a validation error revealing your schema.
- **Validation** runs `schema.parse()`, applying Zod defaults, transforms, and refinements. From this point forward, all downstream stages (interceptors and handler) see the validated params.
- **Interceptors** see validated params and the full `McpToolContext`. Each interceptor decides whether to call `next()` (proceed) or short-circuit. They can also transform the result returned by `next()`.
- **Handler** receives validated params as the first argument and `McpToolContext` as the optional second argument. It is the innermost `next()` in the interceptor chain.
- **Rejection hooks**: when the auth strategy throws, a guard rejects or validation fails, interceptors never run, but each one's optional `onRejected(context, error)` is called, so auditing can record calls that never reached the tool. See [Interceptors](#interceptors).
- **Error handling** in `executeToolWrapped` catches any error from any stage and returns it as an `isError` result — the auth strategy throwing, guards rejecting, validation failing, interceptors throwing, or the handler itself failing all produce structured error responses to the MCP client. See [Error messages](#error-messages) for what the client is told.

The pipeline runs identically regardless of transport — the same guards, validation, and interceptors apply whether the tool is called via MCP HTTP, MCP stdio, `executeToolRaw`/`executeToolWrapped`, or `executeToolForProvider` from the LLM adapter.

## Guards

Guards provide declarative, per-tool authorization. They run after the auth strategy and before validation — if a guard rejects, validation, interceptors, and the handler never execute.

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

When the scope check fails, the registry throws an `McpAccessDeniedError` with the message `Access denied by McpScopeGuard for tool "delete-item".` — which `executeToolWrapped` catches and returns as error content to MCP clients.

Over HTTP with `requireBearerAuth`, the transport checks `McpScopeGuard` scopes before the call reaches the registry. A `tools/call` whose token lacks them gets an HTTP `403` with `WWW-Authenticate: Bearer error="insufficient_scope", scope="..."`, which tells the client which scopes to request so it can ask the user for them and retry (step-up authorization). The `scope` lists the token's current scopes plus the missing ones (and any `requiredScopes`), so one round of consent covers the call. The guard still runs for callers that reach the registry another way.

### Per-caller tool visibility

By default every caller sees every enabled tool in `tools/list`, and guards only refuse the calls they don't allow. To hide tools from callers who can't use them, set `toolVisibility: 'authorized'` on `McpHttpModule` or `McpStdioModule`:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authStrategy: JwtAuthStrategy,
  requireBearerAuth: true,
  toolVisibility: 'authorized', // a tool guarded by McpScopeGuard is listed only to tokens with its scopes
  toolFilter: (tool, authInfo) => !tool.name.startsWith('beta-') || authInfo?.extra?.['beta'] === true, // optional, applied on top
});
```

| Option           | Default | Meaning                                                                                                                                                                                                                                          |
| ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `toolVisibility` | `'all'` | `'all'` lists every enabled tool to everyone. `'authorized'` lists a tool guarded by `McpScopeGuard` (or a subclass) only to a caller whose auth has every scope its `McpScopeGuard` guards require. Tools without one are listed to everyone.   |
| `toolFilter`     | none    | `(tool: McpToolMetadata, authInfo: McpAuthInfo \| undefined) => boolean \| Promise<boolean>`. Return `true` to list the tool. Applied in addition to `toolVisibility`. A filter that throws or rejects hides the tool (and the error is logged). |

A tool is listed to a caller only when all of these hold, in this order:

1. It is enabled. `setToolEnabled(name, false)` hides it from everyone, whatever the rules below say.
2. With `toolVisibility: 'authorized'`, the caller has its `McpScopeGuard` scopes.
3. `toolFilter`, when set, returns `true`.

So `toolFilter` narrows the scope rule when `toolVisibility` is `'authorized'`, and is the only rule when it is `'all'`. Other guards are not consulted: a guard can depend on the call's arguments, which a listing doesn't have. Put rules of your own in `toolFilter`.

The `authInfo` both rules see is the caller's auth after the configured `authStrategy` resolved it: the same auth a guard sees. If the strategy throws, the caller is treated as unauthenticated (`authInfo` is `undefined`) and a warning is logged. The rules run when a server is built for a caller, which with visibility on means the strategy also runs once per 2026-07-28 request and per stateless 2025-era POST (not only for tool calls).

When a server is built for a caller, the tools that caller can't see are not registered on it at all. A tool registered later is checked when it is registered, and wired (with its `listChanged` notification) only onto the servers whose caller may see it. When the rules are decided, per serving mode:

| Serving mode                    | Whose auth decides                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| HTTP, 2026-07-28 request        | That request's auth (`req.auth`: its verified bearer token with `requireBearerAuth`), on every request: each one gets its own server.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| HTTP, 2025-era stateless POST   | That request's auth, on every request.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| HTTP, 2025-era stateful session | The auth of the request that opened the session (`initialize`), until a later request on the session (which must come from the same principal) carries a token, or scope set, that the session hasn't seen before. That request's auth is then resolved again, before the request is handled, and the session's tools follow it: tools it may now see are added, tools it no longer may see are removed, and the client gets `tools/list_changed`. A new token with fewer scopes narrows the set the same way. A session only moves forward: a request with a token it has already moved past (an SSE reconnect or an in-flight request still carrying the old token) is served with the current tools and changes nothing, and a re-resolution overtaken by a newer token before it applies is dropped. Its calls are still checked (the `insufficient_scope` pre-check and the guards), so this grants nothing. Switching back to an earlier token therefore doesn't change the session's tools; open a new session for that. Re-resolutions run one at a time per session; a session remembers its last 16 tokens, and an older one that comes back counts as new. |
| stdio                           | What `authStrategy.resolveAuth(undefined)` returns (stdio carries no token), once per connection. Without an `authStrategy`, the caller is unauthenticated, so `'authorized'` hides every tool that requires a scope.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| custom transport                | The auth you pass to `registry.resolveVisibleTools(authInfo)`; see [Custom transport](#custom-transport).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |

A caller who calls a tool it can't see anyway:

- Over HTTP with `requireBearerAuth`, a token without a tool's `McpScopeGuard` scopes still gets the `403 insufficient_scope` challenge above (it is checked before the request reaches a server), so step-up authorization keeps working. A client that re-authorizes for the scope can retry with the new token right away, on the same stateful session too: the session's visibility is resolved again from the new token before the retry is handled, so the tool runs and appears in `tools/list`. Requests that still carry the old token (say, an SSE reconnect) don't take the tool away again.
- Otherwise (stdio, HTTP without `requireBearerAuth`, or a tool `toolFilter` hid), the call fails exactly like a call to a tool that doesn't exist: a JSON-RPC `-32602` error, `Tool <name> not found`. Nothing tells the caller the tool exists.

`setToolEnabled` keeps working: it toggles the tool on the servers it is registered on, so enabling a tool shows it (and sends `listChanged`) only to sessions whose caller may see it. 2026-07-28 clients are told about tool changes on their `subscriptions/listen` streams, which the SDK shares across callers, so every listening client hears that the tool list changed; each one's next `tools/list` still shows only its own tools.

Visibility is a property of what the transports serve. `registry.executeToolRaw` / `executeToolWrapped` called in-process don't check it; guards still run there.

### Custom guards

Implement `McpCanActivate` and register as a standard NestJS provider:

```typescript
import { Injectable } from '@nestjs/common';
import { McpCanActivate, McpToolContext } from '@onivoro/server-mcp';

@Injectable()
export class RateLimitGuard implements McpCanActivate {
  constructor(private readonly rateLimiter: RateLimiterService) {}

  async canActivate(context: McpToolContext, config?: Record<string, unknown>): Promise<boolean> {
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

Multiple `@McpGuard` decorators stack. Because TypeScript applies decorators bottom-up, guards run starting from the one **closest to the method** and moving upward; the first rejection stops execution:

```typescript
@McpTool({ name: 'admin-action', description: 'Admin only', schema })
@McpGuard(RateLimitGuard, { maxPerMinute: 5 })   // runs second
@McpGuard(McpScopeGuard, { scopes: ['admin'] })  // runs first
async adminAction(params: z.infer<typeof schema>) { ... }
```

`registry.getToolGuards(name)` returns the guards for a tool in execution order.

Any guard that returns `false` makes the registry throw `McpAccessDeniedError` (a subclass of `McpToolError`, with the guard's class name in `guardName`).

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
    if (cached) return cached; // short-circuit — handler never runs

    const result = await next();
    this.cache.set(key, result);
    return result;
  }
}
```

Multiple interceptors chain in registration order using the onion model. If interceptor A is registered before interceptor B, execution flows: A-before → B-before → handler → B-after → A-after. If any interceptor throws (or doesn't call `next()`), downstream interceptors and the handler are skipped.

### Rejected calls

A call that the auth strategy, a guard or validation rejects never reaches the interceptor chain. To see those calls too (for an audit log, say), implement the optional `onRejected(context, error)`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { McpAccessDeniedError, McpToolContext, McpToolInterceptor } from '@onivoro/server-mcp';

@Injectable()
export class DenialLogger implements McpToolInterceptor {
  private readonly logger = new Logger(DenialLogger.name);

  intercept(context: McpToolContext, next: () => Promise<unknown>) {
    return next();
  }

  onRejected(context: McpToolContext, error: unknown) {
    const kind = error instanceof McpAccessDeniedError ? 'denied' : 'rejected';
    this.logger.warn(`${context.toolName} ${kind}: ${(error as Error).message}`);
  }
}
```

`context.params` holds the arguments as received (unvalidated). `context.authInfo` is the resolved auth once the auth strategy has succeeded; if the strategy itself rejected the call, it is the auth info the call arrived with (over HTTP with `requireBearerAuth`, the transport-verified token), or unset if there was none. Errors thrown by `onRejected` are logged and ignored; the call is rejected with the original error either way.

## McpToolRegistry API

The registry is the core of the library. It is injectable in any NestJS service when any of the three entry point modules is imported.

### Registration

Called automatically by the module's discovery phase. You don't call these directly unless you're building custom infrastructure.

| Method                                                | Description                                                                                                                                                                                                |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `registerTool(metadata, handler, guards?)`            | Register a tool with optional guards. Throws on duplicate name.                                                                                                                                            |
| `registerResource(metadata, handler)`                 | Register a resource. Throws on duplicate name.                                                                                                                                                             |
| `registerPrompt(metadata, handler)`                   | Register a prompt. Throws on duplicate name.                                                                                                                                                               |
| `registerInterceptor(interceptor)`                    | Register a `McpToolInterceptor` for all tool executions (and its `onRejected`, if any, for rejected calls).                                                                                                |
| `setGuardResolver(resolver)`                          | Set the function used to resolve guard class instances. Called automatically by all modules.                                                                                                               |
| `setProviderResolver(resolver)`                       | Set the function used to resolve `listStrategy` / `completeStrategy` classes. Called automatically by all modules.                                                                                         |
| `resolveProvider(cls)`                                | Resolve a class through the provider resolver. Throws if no resolver is set.                                                                                                                               |
| `setAuthStrategy(strategy)`                           | Set the auth strategy instance. Called automatically by the HTTP and stdio modules when `authStrategy` is configured.                                                                                      |
| `setExposeErrorMessages(expose)`                      | Whether `executeToolWrapped` returns any error's message (`true`, this release's default) or only `McpToolError`s and validation errors. Set by the modules from `exposeErrorMessages`.                    |
| `setToolVisibility({ toolVisibility?, toolFilter? })` | Which tools each caller sees. Set by the modules from their options; call it for a custom transport. Throws on an unknown `toolVisibility`. See [Per-caller tool visibility](#per-caller-tool-visibility). |
| `onRegistrationChange(listener)`                      | Subscribe to registration events (`'tool'`, `'resource'`, `'prompt'`). Returns an unsubscribe function. Used by `wireRegistryToServer` for dynamic wiring.                                                 |

Registering after startup works: if a server is already wired, `wireRegistryToServer` picks up the new entry through `onRegistrationChange`:

```typescript
this.registry.registerTool({ name: 'ping', description: 'Health check' }, async () => 'pong');
```

### Runtime control and subscriptions

| Method                                                                      | Description                                                                                                                                                                                                   |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `setToolEnabled(name, enabled)`                                             | Show/hide a tool on every wired server, and remember it for servers wired later. Throws if the tool is unknown or nothing serves the registry (see the link). See [Tool enable/disable](#tool-enabledisable). |
| `isToolEnabled(name)`                                                       | Whether a tool is enabled (`true` unless `setToolEnabled(name, false)` was called).                                                                                                                           |
| `setToolEnabledDelegate(delegate)`                                          | Internal hook added by `wireRegistryToServer` for each wired server; returns a remover. Use `setToolEnabled()` instead.                                                                                       |
| `notifyResourceUpdated(uri)`                                                | Emit a resource-updated event to every `onResourceUpdate` listener (wired servers forward it to clients subscribed to `uri`).                                                                                 |
| `onResourceUpdate(listener)`                                                | Listen for `notifyResourceUpdated` calls. Returns an unsubscribe function.                                                                                                                                    |
| `subscribeResource(uri, sessionId)` / `unsubscribeResource(uri, sessionId)` | Track client subscriptions. Called automatically by the wired `resources/subscribe` handlers.                                                                                                                 |
| `getResourceSubscribers(uri)`                                               | `ReadonlySet<string>` of session IDs subscribed to `uri`.                                                                                                                                                     |
| `removeSessionSubscriptions(sessionId)`                                     | Drop all subscriptions for a session. Called automatically when an HTTP session closes.                                                                                                                       |

### Introspection

| Method                           | Returns                                                                                                                                                                       |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getTools()`                     | All registered tools (metadata + handler)                                                                                                                                     |
| `getResources()`                 | All registered resources                                                                                                                                                      |
| `getPrompts()`                   | All registered prompts                                                                                                                                                        |
| `getTool(name)`                  | Single tool by MCP name, or `undefined`                                                                                                                                       |
| `hasTool(name)`                  | `true` if a tool with the given MCP name exists                                                                                                                               |
| `getToolGuards(name)`            | Guard metadata (`{ guardClass, config? }[]`) for a tool, in execution order; `[]` if none or unknown                                                                          |
| `getToolRequiredScopes(name)`    | The scopes a tool's `McpScopeGuard` guards (and subclasses) require together, deduplicated; `[]` if none or unknown                                                           |
| `hasToolVisibilityRules()`       | Whether `toolVisibility: 'authorized'` or a `toolFilter` is set                                                                                                               |
| `resolveVisibleTools(authInfo?)` | `Promise<McpVisibleTools \| undefined>`: the tools that caller sees (after the auth strategy), for `wireRegistryToServer`'s `visibleTools`; `undefined` when no rules are set |

### Execution

| Method                                                | Input name | Returns                        | Use when                          |
| ----------------------------------------------------- | ---------- | ------------------------------ | --------------------------------- |
| `executeToolRaw(name, params, authInfo?, extra?)`     | MCP name   | Raw handler result             | Direct programmatic access, tests |
| `executeToolWrapped(name, params, authInfo?, extra?)` | MCP name   | `McpToolResult` (auto-wrapped) | MCP HTTP and stdio transports     |

The optional `authInfo` parameter is populated automatically by `wireRegistryToServer` (from the MCP SDK's request context, `ctx.http.authInfo`). When calling the registry directly, pass it if you have auth context available. The optional `extra` parameter (`McpToolExecutionExtra`) carries transport-level context (`era`, `sessionId`, `signal`, `inputResponses`, `requestState`, `sendProgress`, `sendLog`, `createMessage`, `elicitInput`, `listRoots`) — also populated automatically by `wireRegistryToServer`. Both methods run the full [execution pipeline](#execution-pipeline): auth strategy → guards → validation → interceptors → handler. `executeToolRaw` throws on any failure (including an unknown tool name), with the original error; `executeToolWrapped` catches and returns `{ content: [{ type: 'text', text: 'Error executing <name>: <message>' }], isError: true }`, where `<message>` is what the client may see (below).

### Error messages

`executeToolWrapped` (and so every MCP transport) logs the full error on the server. What it tells the client depends on the `exposeErrorMessages` setting:

| The error                                                     | `<message>` the client sees                                       |
| ------------------------------------------------------------- | ----------------------------------------------------------------- |
| `McpToolError` (or a subclass such as `McpAccessDeniedError`) | Its message                                                       |
| A Zod validation error                                        | `Invalid arguments: <path>: <issue>; ...`, so the model can retry |
| An unknown tool name                                          | `MCP tool "<name>" is not registered.`                            |
| Anything else, with `exposeErrorMessages: true`               | The error's message                                               |
| Anything else, with `exposeErrorMessages: false`              | `Internal error`                                                  |

Exception messages can carry internal details (hostnames, SQL, stack fragments), so set `exposeErrorMessages: false` (on `McpHttpModule` or `McpStdioModule`) to send a message only when you mean to. In this release the setting defaults to `true`, as before, and the module logs a warning at startup when it isn't set; the default becomes `false` in the next major release. Set it explicitly to keep your choice and silence the warning. With a custom transport, call `registry.setExposeErrorMessages(...)`.

Throw `McpToolError` for messages meant for the client; they reach it either way:

```typescript
import { McpToolError } from '@onivoro/server-mcp';

@McpTool({ name: 'get-invoice', description: 'Get an invoice', schema })
async getInvoice(params: z.infer<typeof schema>) {
  const invoice = await this.invoices.find(params.id);
  if (!invoice) throw new McpToolError(`No invoice with id ${params.id}`);
  return invoice;
}
```

Returning `{ content: [...], isError: true }` yourself also works, and passes through unchanged.

```typescript
const result = await this.registry.executeToolRaw('delete-item', { id: '42' }, { token: 'test', clientId: 'cli', scopes: ['write'] });
```

### Schema conversion

| Method                 | Returns                                                          |
| ---------------------- | ---------------------------------------------------------------- |
| `getToolJsonSchemas()` | `Array<{ name, description, jsonSchema }>` — generic JSON Schema |

The standalone `mcpSchemaToJsonSchema(schema)` does the same conversion for a single `z.ZodObject` (via `z.toJSONSchema()`, with the `$schema` key removed). Passing `undefined` returns `{ type: 'object', properties: {} }`:

```typescript
import { mcpSchemaToJsonSchema } from '@onivoro/server-mcp';

mcpSchemaToJsonSchema(z.object({ id: z.string() }));
// { type: 'object', properties: { id: { type: 'string' } }, required: ['id'], additionalProperties: false }
```

## Configuration

### McpHttpModule (HTTP)

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: {
    name: 'my-server', // Required. Server name reported to MCP clients.
    version: '1.0.0', // Required. Server version.
    description: 'Optional', // Optional. Human-readable description.
    instructions: 'Optional', // Optional. Sent in the initialize response and the server/discover result.
  },
  route: 'mcp', // Optional. Route relative to any Nest global prefix. Default: 'mcp'.
  session: {
    // Optional. Omit for stateless load-balanced tool servers.
    ttlMinutes: 30, // Optional. Idle session timeout. Default: 30.
    idGenerator: () => crypto.randomUUID(), // Optional. Default: crypto.randomUUID().
    eventStore, // Optional. EventStore for SSE resumability.
    principal: (authInfo) => authInfo.extra?.sub as string, // Optional. Who owns a session. Default: clientId + extra.sub.
  },
  enableJsonResponse: false, // Optional. Default: false (SSE responses). true = one JSON body per request.
  serverOptions: {}, // Optional. Passed to McpServer. The module sets capabilities, and instructions when metadata.instructions is set.
  capabilities: { experimental: { 'example/feature': {} } }, // Optional. Added to the capabilities built from the registry; logging/tools/resources/prompts are ignored.
  allowedOrigins: [
    // Optional. Default: same origin only. '*' allows any. See DNS rebinding protection.
    'http://localhost:3000',
    'https://my-app.example.com',
  ],
  allowedHosts: ['mcp.example.com'], // Optional. Default: loopback host names on a loopback socket. See below.
  exposeErrorMessages: false, // Optional. Default: true for now (with a warning); becomes false. See "Error messages".
  authStrategy: JwtAuthStrategy, // Optional. Existing Nest provider class implementing McpAuthStrategy.
  toolVisibility: 'authorized', // Optional. Default: 'all'. 'authorized' lists McpScopeGuard-guarded tools only to tokens with their scopes. See "Per-caller tool visibility".
  toolFilter: (tool, authInfo) => true, // Optional. Your own per-caller rule, applied on top of toolVisibility. See "Per-caller tool visibility".
  requireBearerAuth: {
    // Optional. `true` or an object. HTTP 401 bearer challenge using authStrategy as OAuthTokenVerifier.
    // Ignored unless authStrategy is also set.
    requiredScopes: ['mcp:use'], // Optional. Scopes every request needs.
    resourceMetadataUrl: '/.well-known/oauth-protected-resource/mcp', // Optional. Default: derived from the route.
    expectedResource: 'https://api.example.com/mcp', // Optional. Reject tokens whose resource differs.
  },
});
```

### McpStdioModule (Stdio)

```typescript
McpStdioModule.registerAndServeStdio({
  metadata: {
    name: 'my-server', // Required. Server name reported to MCP clients.
    version: '1.0.0', // Required. Server version.
    description: 'Optional', // Optional. Human-readable description.
    instructions: 'Optional', // Optional. Sent in the initialize response and the server/discover result.
  },
  serverOptions: {}, // Optional. Passed to McpServer. The module sets capabilities, and instructions when metadata.instructions is set.
  capabilities: { experimental: { 'claude/channel': {} } }, // Optional. Added to the capabilities built from the registry; logging/tools/resources/prompts are ignored.
  protocolNegotiation: 'auto', // Optional. 'auto' (default) serves both eras; 'legacy' serves only 2025-era clients.
  onServerCreated: (server, { era }) => {}, // Optional. Receives each McpServer the module builds, before it connects.
  stdin: process.stdin, // Optional. Defaults to process.stdin.
  stdout: process.stdout, // Optional. Defaults to process.stdout.
  redirectLogsToStderr: true, // Optional. Default: true on process.stdout. See "Logging goes to stderr".
  exposeErrorMessages: false, // Optional. Default: true for now (with a warning); becomes false. See "Error messages".
  authStrategy: JwtAuthStrategy, // Optional. Existing Nest provider class implementing McpAuthStrategy.
  toolVisibility: 'authorized', // Optional. Default: 'all'. Decided from authStrategy.resolveAuth(undefined), once per connection. See "Per-caller tool visibility".
  toolFilter: (tool, authInfo) => true, // Optional. Your own rule, applied on top of toolVisibility. See "Per-caller tool visibility".
});
```

## Authentication

Authentication works at three layers:

### Transport-level authentication

For MCP HTTP servers, the default transport-level auth mechanism is `requireBearerAuth`:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authStrategy: JwtAuthStrategy,
  requireBearerAuth: true,
});
```

When enabled, unauthenticated HTTP requests (all methods except `OPTIONS`) are rejected before MCP session or tool handling with a `401` challenge and `WWW-Authenticate` metadata. (The `Host` and `Origin` checks run first and answer `403`, and a stateless server answers `GET`/`DELETE` with `405` before authentication.) This is the mechanism MCP clients use to trigger OAuth automatically.

`requireBearerAuth` only takes effect when `authStrategy` is also set, and that provider must implement the SDK's `OAuthTokenVerifier` (`verifyAccessToken()`, from `@modelcontextprotocol/server`); otherwise module init throws. `McpJwtAuthStrategy` from `@onivoro/server-mcp-auth` implements both interfaces.

A verifier rejects a token by throwing `new OAuthError(OAuthErrorCode.InvalidToken, message)` (from `@modelcontextprotocol/server`), which becomes the `401` challenge. v1-style errors (`InvalidTokenError` and friends, still exported by `@modelcontextprotocol/server-legacy/auth`) are translated to the matching challenge, with a one-time warning; any other error becomes a `500`. `OAuthError`, `OAuthErrorCode`, `OAuthTokenVerifier` and `AuthInfo` are re-exported by this package. The verified token must have an `expiresAt`, or it is rejected.

Authentication applies to clients of both protocol eras: the verified token reaches tools as `context.authInfo` either way.

You can customize the advertised Protected Resource Metadata URL:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authStrategy: JwtAuthStrategy,
  requireBearerAuth: {
    requiredScopes: ['read'],
    resourceMetadataUrl: '/.well-known/oauth-protected-resource',
  },
});
```

`resourceMetadataUrl` must be an absolute URL or a root-relative path (validated at init). If it is omitted, the module derives the RFC 9728 path-specific URL from the MCP route it serves.

`expectedResource` (an absolute URL, validated at init) makes the transport reject, with `401`, any token whose `resource` (as the verifier reports it) isn't this server. It adds to the audience check the verifier does itself; `McpJwtAuthStrategy` reports `resourceIdentifier` as the resource once it has checked the token's `aud`.

Two more things happen on authenticated requests:

- **Scope challenges.** A `tools/call` for a tool guarded by `McpScopeGuard` whose token lacks the scopes gets `403 insufficient_scope`, so the client can ask for them. See [Built-in scope guard](#built-in-scope-guard).
- **Session ownership.** With stateful sessions, a session belongs to the principal that opened it: by default the token's `clientId` plus `extra.sub` (the JWT subject, which `@onivoro/server-mcp-auth` provides). Another principal presenting the same `Mcp-Session-Id` gets `404`, as if the session didn't exist. Pass `session.principal` to identify owners differently.

Route examples:

| Host app                     | `route`            | MCP endpoint        | Default path-derived PRM URL                                 |
| ---------------------------- | ------------------ | ------------------- | ------------------------------------------------------------ |
| Standalone                   | omitted or `'mcp'` | `/mcp`              | `/.well-known/oauth-protected-resource/mcp`                  |
| Standalone                   | `'internal/mcp'`   | `/internal/mcp`     | `/.well-known/oauth-protected-resource/internal/mcp`         |
| `app.setGlobalPrefix('api')` | omitted or `'mcp'` | `/api/mcp`          | `/api/.well-known/oauth-protected-resource/api/mcp`          |
| `app.setGlobalPrefix('api')` | `'internal/mcp'`   | `/api/internal/mcp` | `/api/.well-known/oauth-protected-resource/api/internal/mcp` |

### Serving the path-derived PRM route yourself

`@onivoro/server-mcp-auth` serves these routes for you. (So does the deprecated `@onivoro/server-mcp-oauth`; if you still import both, pass `serveProtectedResourceMetadata: false` to `McpOAuthModule`.) If you write your own controller for them, use the route helpers. Nest 10 and Nest 11 need different wildcard syntax: Nest 11's path-to-regexp v8 rejects `:param(*)`, and Nest 10 misreads `*param`. No single route string works on both.

- `PROTECTED_RESOURCE_WILDCARD` is the wildcard for the installed Nest, computed once when the package loads. It reads the version of `@nestjs/core` resolved from the app's working directory first, then the one this package resolves. If neither can be read, it logs a warning and uses the Nest 11 syntax.
- `protectedResourceWildcardRoute(nestVersion)` returns `'*resourcePath'` when the major version of `nestVersion` is 11 or higher, and `':resourcePath(*)'` otherwise. Use it to pick the syntax for a version you supply yourself. The parameter is always named `resourcePath`.
- `wildcardParamToPath(value)` turns the matched parameter into a path. Nest 10 passes a string and Nest 11 an array of segments, which are joined with `/`. Trailing slashes are removed, so `api/mcp/` becomes `api/mcp`; leading and doubled slashes are kept. `undefined` becomes `''`.

```typescript
import { Controller, Get, Param } from '@nestjs/common';
import { PROTECTED_RESOURCE_WILDCARD, wildcardParamToPath } from '@onivoro/server-mcp';

@Controller('.well-known')
export class MyProtectedResourceController {
  @Get(`oauth-protected-resource/${PROTECTED_RESOURCE_WILDCARD}`)
  getMetadata(@Param('resourcePath') resourcePath: string | string[] | undefined) {
    const path = wildcardParamToPath(resourcePath); // e.g. 'api/mcp'
    // ...
  }
}
```

### Auth strategy (centralized auth enrichment)

The `authStrategy` config option uses a centralized auth strategy that runs before guards on every tool execution. It receives the raw `authInfo` from the transport and can validate tokens, decode JWTs, hydrate user context, or reject unauthenticated requests in one place, with full access to NestJS DI.

Implement `McpAuthStrategy` as an `@Injectable()` service:

```typescript
import { Injectable } from '@nestjs/common';
import { McpAuthStrategy, McpAuthInfo } from '@onivoro/server-mcp';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from './users.service';

@Injectable()
export class JwtAuthStrategy implements McpAuthStrategy {
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

Register the strategy in a NestJS module, then pass the class to the transport config:

```typescript
@Module({
  providers: [JwtService, UsersService, JwtAuthStrategy],
  exports: [JwtAuthStrategy],
})
export class AuthModule {}

@Module({
  imports: [
    AuthModule,
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '1.0.0' },
      authStrategy: JwtAuthStrategy,
    }),
  ],
})
export class AppModule {}
```

The same provider-resolution pattern works for `McpStdioModule.registerAndServeStdio()` and other MCP transport modules.

If the strategy is not registered in another imported module, Nest will fail to resolve its constructor dependencies when the transport attempts to look it up.

If you prefer, you can also register the strategy in the same application module's `providers` array, as long as that provider is part of the Nest container before the transport module initializes.

Passing the class to `authStrategy` looks like this:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authStrategy: JwtAuthStrategy,
});
```

`McpHttpModule` resolves the existing provider through `ModuleRef`; it does not create a new provider for the strategy class. This follows the same DI pattern as guards.

**What the auth strategy can do:**

| Action           | How                                          | Effect                                          |
| ---------------- | -------------------------------------------- | ----------------------------------------------- |
| **Enrich**       | Return a new `McpAuthInfo` with extra claims | Guards and handlers receive the enriched auth   |
| **Reject**       | Throw an error                               | Execution stops before guards run               |
| **Clear**        | Return `undefined`                           | Guards and handlers receive no auth (anonymous) |
| **Pass through** | Return the input unchanged                   | Same as no provider                             |

**Why use an auth strategy instead of a guard?** Guards return `boolean` — they can approve or deny, but cannot modify the auth context. An auth strategy transforms `authInfo` before any guards see it. This means you decode a JWT once centrally, and all guards receive the decoded claims without each needing to parse the token independently.

### Auth already resolved in-process

The auth strategy runs on every tool call, including in-process calls such as an agentic loop calling `McpToolRegistry` directly. Sometimes the caller has already verified the token another way, for example a web app's own access token that the MCP route's strategy is configured to reject. Mark that auth info with `markMcpAuthInfoResolved()` and the registry passes it straight to the guards without calling the strategy:

```typescript
import { markMcpAuthInfoResolved } from '@onivoro/server-mcp';

const authInfo = markMcpAuthInfoResolved(await verifyWebAppToken(token));
await registry.executeToolRaw('search-orders', params, authInfo);
```

- Guards still run. Only `resolveAuth()` is skipped, so the marked auth info must already be enriched the way guards and handlers expect.
- The mark belongs to the exact object passed in. A copy (`{ ...authInfo }`) or a JSON round trip is not marked, and nothing in `extra`, a token claim or a request body can mark it. Mark the final object and pass it on unchanged.
- The same marked object is shared by every call it is passed to, such as every tool call in an agentic run. Guards, interceptors and handlers should treat it as read-only.
- It is verified once, by the caller, and trusted until discarded: `expiresAt` is not re-checked. Mark it per run or request, and do not cache it across requests.
- Auth info arriving over HTTP or stdio is never trusted this way: `wireRegistryToServer` hands the registry a copy, so the strategy always runs for transport calls.
- `isMcpAuthInfoResolved(authInfo)` reports whether an object is marked.
- The mark is held by this copy of `@onivoro/server-mcp`. If an app ends up with two copies installed, auth marked by one is not recognised by the other, and the strategy runs (the safe failure).

### Custom transport middleware

If you need non-standard transport behavior, you can still add your own NestJS middleware around the MCP route. This is an advanced option; prefer `requireBearerAuth` for spec-compliant OAuth challenges.

### Tool-level authorization

When the MCP SDK's OAuth 2.1 flow is in use, `authInfo` (token, clientId, scopes) flows from the transport through the auth strategy (if configured), then to guards and tool handlers. Use `@McpGuard` for declarative per-tool scope checks:

```typescript
@McpTool({ name: 'read-data', description: 'Read data', schema })
@McpGuard(McpScopeGuard, { scopes: ['read'] })
async readData(params: z.infer<typeof schema>) { ... }

@McpTool({ name: 'delete-data', description: 'Delete data', schema })
@McpGuard(McpScopeGuard, { scopes: ['admin'] })
async deleteData(params: z.infer<typeof schema>) { ... }
```

For custom authorization logic beyond scope checking, implement a `McpCanActivate` guard — see [Guards](#guards).

Guards refuse calls, but by default `tools/list` still shows every tool to every caller. To hide `delete-data` from tokens without the `admin` scope, set `toolVisibility: 'authorized'` (and, for rules of your own, `toolFilter`) on the module — see [Per-caller tool visibility](#per-caller-tool-visibility).

## Package combinations

| Goal                                           | Packages                                                                         | Notes                                                                                                                                                                                                                                                     |
| ---------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Plain MCP server                               | `@onivoro/server-mcp`                                                            | No auth required                                                                                                                                                                                                                                          |
| Protected MCP server using external JWT/OAuth  | `@onivoro/server-mcp` + `@onivoro/server-mcp-auth`                               | Use `authStrategy: McpJwtAuthStrategy` and `requireBearerAuth: true`                                                                                                                                                                                      |
| Embedded OAuth authorization server only       | `@onivoro/server-mcp-oauth`                                                      | **Deprecated** — use a dedicated authorization server. Publishes auth-server endpoints; does not serve or protect tools by itself                                                                                                                         |
| Embedded OAuth server plus protected MCP route | `@onivoro/server-mcp` + `@onivoro/server-mcp-auth` + `@onivoro/server-mcp-oauth` | **Deprecated** — use a dedicated authorization server with `@onivoro/server-mcp-auth`. End-to-end issue, discover, challenge, and validate; pass `serveProtectedResourceMetadata: false` to `McpOAuthModule` so only `McpAuthModule` serves the PRM route |

See also: [MCP Server Package Guide](https://github.com/onivoro/monorepo/blob/main/libs/server/mcp-package-guide.md)

## Tested behavior

The package test suite covers:

- Streamable HTTP session lifecycle, stale-session recovery, and session ownership
- stateless HTTP: `405` for `GET`/`DELETE`, ignored session headers, and the capabilities it advertises
- `Origin` and `Host` validation
- stdio transport wiring and its stderr logging
- registry discovery and execution, including which error messages reach the client
- end to end over HTTP, with the MCP SDK's own v2 client in both protocol eras against stateful and stateless servers: `inputRequired` (bridged to elicitation for 2025-era clients), progress, log levels, list-changed notifications over `subscriptions/listen`, and resource updates
- end to end over stdio in both eras, including list-changed notifications, and a Claude Code channel: extra capabilities, `instructions`, notifications sent through `McpStdioService` (readiness through a `server/discover` probe that falls back to `initialize` or is followed only by `subscriptions/listen`, a 2026-07-28 client that doesn't probe, and a refused 2026-07-28 claim followed by a probe and a fallback, closing, aborting, refused notifications), `protocolNegotiation: 'legacy'`, and `onServerCreated` (including one that replaces the SDK callbacks or throws)
- in memory against the SDK client (2025 protocol): prompt completions, progress, log levels, sampling, structured output, error messages, and the context resource and prompt handlers receive
- HTTP bearer challenge behavior, `insufficient_scope` challenges, the translation of v1-style verifier errors, and PRM URL derivation
- per-caller tool visibility, end to end over HTTP with the SDK client in both eras against stateless and stateful servers, and over stdio in both eras: with `toolVisibility: 'authorized'` an `McpScopeGuard({ scopes: ['admin'] })` tool is missing from `tools/list` for a non-admin token and listed for an admin one; a non-admin call is refused (`403 insufficient_scope` over HTTP with `requireBearerAuth`, `Tool <name> not found` over stdio) and never reaches the tool; the default `'all'` lists it and the guard refuses the call; `toolFilter` applies on top of the scope rule; in stateful sessions, `setToolEnabled` hides a tool from everyone and re-enabling it notifies and shows it only to admin sessions, and a scoped tool registered later reaches only the sessions that may see it; while a caller's visibility is still being decided, a client that goes away leaves no server wired to the registry, and a tool registered meanwhile still reaches a stateful session or stdio connection that may see it; on a stateful session, a client that gets `403 insufficient_scope` and retries with a stepped-up token runs the tool, sees it listed and gets `tools/list_changed`, a later new, narrower token hides it again, the same token doesn't resolve the visibility again, and a request still carrying the token the session moved past (even one arriving while the stepped-up token's resolution is pending) neither resolves again, notifies, nor takes the tool away. Unit tests cover the auth strategy's role (enrichment, failure, marked auth), filters that throw, and `wireRegistryToServer`'s `visibleTools` and `setVisibleTools` (including decisions made for a set that was replaced meanwhile)
- auth strategy resolution through Nest DI
- the PRM route helpers: wildcard syntax per Nest major, reading the installed Nest version and its fallback, and trailing-slash handling

## Troubleshooting

- `Session not found` (404)
  Restart the client or ensure the first request after reconnect is `initialize`. HTTP sessions are in-memory by default. With bearer auth, the session may also belong to a different user than the token's.
- `403` with `Origin "..." is not allowed` or `Host "..." is not allowed`
  A browser-based client on another origin needs `allowedOrigins`. A server reached through a host name on a loopback address needs `allowedHosts`, or a proxy that sends `X-Forwarded-*` headers. See [DNS rebinding protection](#dns-rebinding-protection).
- `405` on `GET` or `DELETE`
  Expected in stateless mode (no `session` config): there is no stream to open and no session to delete. 2026-07-28 clients never send them.
- Progress or logs never arrive
  They need SSE responses (`enableJsonResponse: false`, the default). A 2026-07-28 client only gets log messages for requests that name a log level.
- A tool that returns `inputRequired(...)` fails for a 2025-era client
  The SDK has to send that client requests: use stateful `session` and SSE responses, or stdio. The client must also support elicitation (or whatever the tool asks for).
- A 2026-07-28 client never hears about new tools or resource updates
  It has to open a `subscriptions/listen` stream; the SDK client does that when you configure `listChanged`, or call `client.listen(...)`.
- Anonymous requests still work
  Set `requireBearerAuth: true`. An `authStrategy` alone does not force an HTTP `401` challenge.
- Fastify does not work
  `McpHttpModule` requires Express. Use `McpRegistryModule.registerOnly()` and a custom controller for Fastify.
- Request body parsing error
  Ensure the app is using Nest’s Express platform and standard body parsing.

## DNS rebinding protection

The MCP spec requires Streamable HTTP servers to validate the `Origin` header, and to answer an invalid one with `403`. That protects a server from web pages: in a DNS rebinding attack, a malicious site points its own host name at the server's address (typically `127.0.0.1`), so the browser treats requests to a locally running MCP server as same-origin.

The module checks every request, before authentication:

- **`Origin`.** A request without `Origin` is allowed; non-browser MCP clients (Claude Desktop, Claude Code, curl) don't send it. With `allowedOrigins` set, the origin must be in the list (`'*'` allows any). Without it, only the server's own origin is allowed: the origin's host (and port) must match the request's, taken from `X-Forwarded-Host` when a proxy sets it, else `Host`.
- **`Host`.** With `allowedHosts` set, the `Host` header must be in the list (`host` or `host:port`, case-insensitive). Without it, a request that arrives on a loopback address (`127.0.0.1`, `::1`) must name `localhost`, `127.0.0.1` or `[::1]`, unless it carries `X-Forwarded-For`, `X-Forwarded-Host` or `Forwarded` (a local reverse proxy forwarding the public host name; a browser can't add those to a cross-origin request without a CORS preflight). Other requests aren't checked.

A rebound page sends a matching `Origin` and `Host`, so the `Host` check is what stops it for local servers. Set `allowedHosts` when a server reached by its own host name must also be protected.

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  allowedOrigins: ['http://localhost:6274', 'https://my-app.example.com'], // e.g. MCP Inspector, a web client
  allowedHosts: ['mcp.example.com', 'localhost:3000'],
});
```

Browser-based clients on another origin, such as MCP Inspector connecting directly from its web UI, need their origin in `allowedOrigins`.

## CORS

The library exports constants for MCP protocol compliance:

| Export                     | Values                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `MCP_CORS_METHODS`         | `GET`, `POST`, `DELETE`, `OPTIONS`                                                                                                          |
| `MCP_CORS_ALLOWED_HEADERS` | `Content-Type`, `Accept`, `Authorization`, `x-api-key`, `Mcp-Session-Id`, `Mcp-Protocol-Version`, `Last-Event-ID`, `Mcp-Method`, `Mcp-Name` |
| `MCP_CORS_EXPOSED_HEADERS` | `Mcp-Session-Id`, `Mcp-Protocol-Version`, `WWW-Authenticate`                                                                                |
| `MCP_CORS_CONFIG`          | Complete CORS config object combining the above (pass directly to `app.enableCors()`)                                                       |

2026-07-28 clients send `Mcp-Method` and `Mcp-Name` on every request. A tool can also ask clients to mirror arguments into `Mcp-Param-<name>` headers; CORS can't allow those by pattern, so a browser client calling such a tool needs them added to `allowedHeaders` by name.

## Transport lifecycle

### HTTP (`McpHttpModule`)

This library implements the **Streamable HTTP** transport, not the legacy SSE transport:

- **SSE transport (legacy)**: Two endpoints — `GET /sse` opens a persistent SSE stream for server-to-client messages, `POST /messages` sends client-to-server requests. This was the original MCP HTTP transport.
- **Streamable HTTP (current)**: A single `/mcp` endpoint (this module handles `POST`, `GET`, `DELETE`, and `OPTIONS` on it). By default each POST is answered with an SSE stream, which carries progress, log messages and server-to-client requests sent while a tool runs, then the result. With `enableJsonResponse: true`, each POST gets a single JSON body instead, and those in-flight messages can't be sent.

The endpoint serves both protocol eras. Each POST is classified by the SDK (`isLegacyRequest`):

- **2026-07-28 requests** carry the protocol version in `_meta`. They go to the SDK's `createMcpHandler`, which builds a server for the request and discards it afterwards. There are no sessions and no `initialize`, whatever the `session` config says; clients find out about changes on `subscriptions/listen` streams, which the handler keeps open and the module feeds from the registry.
- **Everything else** — `initialize`, requests without the 2026 `_meta`, and all `GET`/`DELETE` — is a 2025-era client's, and is served as below, statelessly or with sessions.

By default, HTTP MCP is stateless. When `session` is omitted, the server does
not emit `Mcp-Session-Id`, and each request can be handled by any instance.
This is the recommended mode for load-balanced request/response tool servers
where auth is carried by each HTTP request, such as OAuth bearer-token protected
tool APIs. (2026-07-28 clients are served statelessly in either mode.)

In stateless mode each 2025-era POST gets its own MCP server, which is unwired
from the registry and closed when the response closes. (In stateful mode the same
happens to a server whose request never initializes a session.) A stateless server
answers `GET` and `DELETE` with `405`, since there is no standalone stream or
session, and ignores any `Mcp-Session-Id` header. For 2025-era clients it
advertises `listChanged: false` and resource `subscribe: false`, because it has no
stream for notifications outside a request, and their tools get no
`createMessage`, `elicitInput` or `listRoots` and can't use `inputRequired`,
because a per-request server can't send requests back.

Stateless mode is MCP spec-compliant: Streamable HTTP servers may assign session
IDs, but are not required to. If a server does assign one, clients must send it
back; if it does not, clients should continue without session headers.

#### Stateful Sessions

Configure `session` only when the server needs stateful MCP sessions:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  session: {
    ttlMinutes: 30,
  },
});
```

When `session` is present, the server creates an `Mcp-Session-Id` when a
2025-era client initializes and requires it on that client's later requests.
Use this when 2025-era clients need resource subscriptions, list-changed
notifications, `inputRequired` or other server-to-client requests, resumable SSE
streams, or deliberate per-session server state, on a single instance or a
sticky-routed deployment. 2026-07-28 clients get subscriptions, list-changed
notifications and `inputRequired` without sessions; their protocol has no
resumable streams or per-session state.

Stateful sessions are created on the first `POST /mcp` initialize handshake,
destroyed on `DELETE /mcp` or idle TTL expiry, and cleaned up on application
shutdown.

#### Resumability

2025-era clients can reconnect after a network drop and resume their SSE stream from where they left off. This requires an `EventStore` implementation that persists outgoing events so they can be replayed on reconnect. (Spec 2026-07-28 drops resumability: a 2026-07-28 client whose stream breaks retries the request.)

```typescript
import { randomUUID } from 'node:crypto';
import type { JSONRPCMessage } from '@modelcontextprotocol/server';
import type { EventId, EventStore, StreamId } from '@onivoro/server-mcp';

// In-memory store for development (events are lost on restart)
class InMemoryEventStore implements EventStore {
  private readonly events = new Map<EventId, { streamId: StreamId; message: JSONRPCMessage }>();

  async storeEvent(streamId: StreamId, message: JSONRPCMessage): Promise<EventId> {
    const id = `${streamId}_${randomUUID()}`;
    this.events.set(id, { streamId, message });
    return id;
  }

  async replayEventsAfter(lastEventId: EventId, { send }: { send: (eventId: EventId, message: JSONRPCMessage) => Promise<void> }): Promise<StreamId> {
    const streamId = this.events.get(lastEventId)?.streamId ?? '';
    let replaying = false;
    for (const [id, event] of this.events) {
      if (id === lastEventId) {
        replaying = true;
        continue;
      }
      if (replaying && event.streamId === streamId) await send(id, event.message);
    }
    return streamId;
  }
}

const eventStore = new InMemoryEventStore();

McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  session: {
    eventStore, // Enable resumability
  },
});
```

For production, implement `EventStore` with a persistent backend (Redis, database). Resumability needs SSE responses, so leave `enableJsonResponse` at its default (`false`).

Additional transport options:

| Option                | Default                             | Description                                                                               |
| --------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------- |
| `session`             | `undefined`                         | Omit for stateless mode. Configure to enable stateful MCP sessions                        |
| `session.ttlMinutes`  | `30`                                | Idle timeout for stateful sessions                                                        |
| `session.idGenerator` | `crypto.randomUUID()`               | Custom stateful session ID generator                                                      |
| `session.eventStore`  | `undefined`                         | Event store for SSE resumability                                                          |
| `session.principal`   | `clientId` + `extra.sub`            | Who owns a session; see [Transport-level authentication](#transport-level-authentication) |
| `enableJsonResponse`  | `false`                             | Return one JSON body instead of an SSE stream                                             |
| `allowedOrigins`      | same origin only                    | See [DNS rebinding protection](#dns-rebinding-protection)                                 |
| `allowedHosts`        | loopback names on a loopback socket | See [DNS rebinding protection](#dns-rebinding-protection)                                 |

### Stdio (`McpStdioModule`)

`onModuleInit` starts `serveStdio` on a `StdioServerTransport`. The `McpServer` is built when the client's first message arrives, for the era that message speaks (the SDK may also build and discard one to answer a `server/discover` probe). With `protocolNegotiation: 'legacy'` it instead builds one 2025-era server at once and connects it to the transport. There are no sessions — the connection lasts for the lifetime of the process.

- The server starts automatically when the NestJS application context initializes.
- Nest's logs go to stderr, since stdout carries the protocol. See [Logging goes to stderr](#logging-goes-to-stderr).
- The transport and server are closed on application shutdown (`onModuleDestroy`).
- Use `NestFactory.createApplicationContext()` instead of `NestFactory.create()` — there's no HTTP listener.

### Registry only (`McpRegistryModule`)

No transport is created. Tools are discovered and registered into `McpToolRegistry` during module init. You call the registry's execution methods directly from your own code, or use the adapter library `@onivoro/server-mcp-llm-adapter`.

## Exports

```typescript
// Modules
McpHttpModule; // HTTP transport — use McpHttpModule.registerAndServeHttp()
McpStdioModule; // Stdio transport — use McpStdioModule.registerAndServeStdio()
McpRegistryModule; // Registry only — use McpRegistryModule.registerOnly()

// Registry
McpToolRegistry; // Injectable registry — execution, introspection, schema conversion
McpToolResult; // { content: McpContentBlock[], structuredContent?, isError?, _meta? }
McpContentBlock; // Union of all MCP content types
McpTextContent; // { type: 'text', text, annotations? }
McpImageContent; // { type: 'image', data, mimeType, annotations? }
McpAudioContent; // { type: 'audio', data, mimeType, annotations? }
McpEmbeddedResource; // { type: 'resource', resource: { uri, text?, blob?, mimeType? }, annotations? }
McpResourceLink; // { type: 'resource_link', uri, name, description?, mimeType?, annotations? }
McpResourceContents; // { uri, mimeType?, text?, blob?, _meta? }
McpResourceResult; // { contents: McpResourceContents[], _meta? }
McpPromptMessage; // { role: 'user' | 'assistant', content: McpContentBlock }
McpPromptResult; // { description?, messages: McpPromptMessage[], _meta? }

// Auth & execution context
McpAuthInfo; // { token, clientId, scopes, expiresAt?, resource?, extra? }
McpAuthStrategy; // Interface — resolveAuth(authInfo?) for centralized auth validation and enrichment
markMcpAuthInfoResolved; // (authInfo) => authInfo — in-process callers: skip the auth strategy for this exact object (guards still run)
isMcpAuthInfoResolved; // (authInfo?) => boolean — whether that exact object was marked
McpToolContext; // { toolName, params, metadata, authInfo?, era?, sessionId?, signal?, sendProgress?, sendLog?, inputResponses?, requestState?, createMessage?, elicitInput?, listRoots? }
McpToolExecutionExtra; // The transport-level part of McpToolContext — executeToolRaw/executeToolWrapped's `extra`
McpHandlerContext; // { authInfo?, era?, sessionId?, signal?, inputResponses?, requestState? } — what resource and prompt handlers receive
McpProtocolEra; // 'modern' (spec 2026-07-28) | 'legacy' (2025-11-25 and earlier)
McpLogLevel; // 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency'

// Guards
McpGuard; // Method decorator — @McpGuard(GuardClass, config?)
McpCanActivate; // Interface for custom guard classes
McpGuardMetadata; // { guardClass, config? }
McpToolVisibility; // 'all' | 'authorized'
McpToolFilter; // (tool, authInfo) => boolean | Promise<boolean>
McpToolVisibilityOptions; // { toolVisibility?, toolFilter? } — on McpModuleConfig and McpStdioConfig
McpVisibleTools; // From registry.resolveVisibleTools(authInfo): { has(name), decided(name), evaluate(name) } — wireRegistryToServer's visibleTools
McpScopeGuard; // Built-in guard — checks authInfo.scopes against required scopes

// Interceptors
McpToolInterceptor; // Interface — intercept(context, next) onion-model wrapping; optional onRejected(context, error)

// Errors
McpToolError; // Error whose message is shown to the MCP client
McpAccessDeniedError; // McpToolError thrown when a guard rejects a call; guardName holds the guard class name

// Registration change events
McpRegistrationChangeType; // 'tool' | 'resource' | 'prompt'
McpRegistrationChangeListener; // (type, name) => void — callback for dynamic registration
McpResourceUpdateListener; // (uri: string) => void — callback for resource update notifications

// Decorators
McpTool; // Method decorator for tools (schema: z.ZodObject)
McpResource; // Method decorator for resources
McpPrompt; // Method decorator for prompts

// Schema converters
mcpSchemaToJsonSchema; // z.ZodObject → JSON Schema object (via zod v4 native z.toJSONSchema)

// Wiring helpers
wireRegistryToServer; // (registry, server, options?) — register all entries onto McpServer + subscribe to future changes; returns McpServerWiring
McpServerWiring; // The unsubscribe function, with setVisibleTools(visibleTools) to change which tools the server's caller sees
WireRegistryToServerOptions; // { requestScopedMessages?, unsolicitedMessages?, era?, followRegistry?, visibleTools? } — the server's era, what its transport can deliver, and which tools its caller sees
buildCapabilities; // (registry, { logging?, notifications?, extra? }?) => ServerCapabilities — from current registry state, plus `extra` (minus the keys it builds)
wrapResourceResult; // Auto-wrap raw handler return → McpResourceResult
wrapPromptResult; // Auto-wrap raw handler return → McpPromptResult

// Route utilities
PROTECTED_RESOURCE_WILDCARD; // '*resourcePath' or ':resourcePath(*)', for the installed Nest
protectedResourceWildcardRoute; // (nestVersion) => '*resourcePath' (Nest 11+) or ':resourcePath(*)' (Nest 10)
wildcardParamToPath; // (string | string[] | undefined) => path string; joins Nest 11 segments with '/', drops trailing slashes

// SDK re-exports (from @modelcontextprotocol/server; the same objects, not wrappers)
McpServer; // The SDK's server class, for custom transports
OAuthError; // Throw from a token verifier: new OAuthError(OAuthErrorCode.InvalidToken, message)
OAuthErrorCode; // OAuth error codes ('invalid_token', 'insufficient_scope', ...)
AuthInfo; // Type — what a token verifier returns
OAuthTokenVerifier; // Type — { verifyAccessToken(token): Promise<AuthInfo> }
inputRequired; // Build an InputRequiredResult: inputRequired({ inputRequests, requestState? }), inputRequired.elicit(...), .elicitUrl(...)
acceptedContent; // (inputResponses, key, schema?) => the accepted, validated answer, or undefined
inputResponse; // (inputResponses, key) => the answer as { kind: 'missing' | 'elicit' | 'sampling' | 'roots', ... }
createRequestStateCodec; // Sign and verify requestState carried across inputRequired rounds
InputRequiredResult; // Type — what inputRequired() returns
EventStore; // Interface for SSE resumability event storage
StreamId; // String alias for stream identifiers
EventId; // String alias for event identifiers

// Interfaces
McpModuleConfig; // Configuration for McpHttpModule.registerAndServeHttp()
McpHttpSessionConfig; // { ttlMinutes?, idGenerator?, eventStore?, principal? } — McpModuleConfig.session
McpModuleAsyncOptions; // { route?, imports?, inject?, useFactory } for McpHttpModule.registerAndServeHttpAsync()
McpAsyncModuleConfig; // Omit<McpModuleConfig, 'route'> — what the async useFactory returns
McpStdioConfig; // Configuration for McpStdioModule.registerAndServeStdio()
McpStdioAsyncOptions; // { imports?, inject?, useFactory, redirectLogsToStderr? } for McpStdioModule.registerAndServeStdioAsync()
McpServerMetadata; // { name, version, description?, instructions? }
McpServerBaseConfig; // { metadata, serverOptions?, capabilities? } — what McpModuleConfig and McpStdioConfig share
McpExtraCapabilities; // ServerCapabilities without McpModuleCapabilityKey — the `capabilities` option's type
McpModuleCapabilityKey; // 'logging' | 'tools' | 'resources' | 'prompts' — capability keys the modules build
McpToolMetadata; // { name, description, title?, schema?, outputSchema?, aliases?, annotations?, icons? }
McpToolAnnotations; // { readOnlyHint?, destructiveHint?, idempotentHint?, openWorldHint? }
McpIcon; // { src: string, mimeType?, sizes?: string[], theme?: 'light' | 'dark' } — icon for tools/resources/prompts
McpResourceMetadata; // { name, uri, title?, description?, mimeType?, size?, icons?, annotations?, isTemplate?, listStrategy?, completeStrategy? }
McpResourceAnnotations; // { audience?, priority?, lastModified? } — annotations for resources
McpPromptMetadata; // { name, title?, description?, argsSchema?, icons?, completeStrategy? }

// Provider interfaces
McpResourceListStrategy; // Interface — list() for resource template list callbacks
McpCompletionStrategy; // Interface — complete(argName, value, context?) for completion callbacks

// Services
McpHttpService; // HTTP session manager — handleRequest(req, res); exported only by McpHttpModule
McpStderrLogger; // Nest ConsoleLogger that writes every level to stderr, for stdio servers
McpStdioService; // sendNotification(method, params?), whenConnected(signal?), isConnected(), getProtocolEra(); exported only by McpStdioModule
McpStdioClosedError; // What whenConnected() rejects with once the stdio connection has closed

// Constants
MCP_MODULE_CONFIG; // DI token for McpHttpModule config
MCP_STDIO_CONFIG; // DI token for McpStdioModule config
MCP_TOOL_METADATA; // Reflect metadata key
MCP_RESOURCE_METADATA; // Reflect metadata key
MCP_PROMPT_METADATA; // Reflect metadata key
MCP_GUARD_METADATA; // Reflect metadata key for @McpGuard
MCP_CORS_METHODS; // CORS methods array
MCP_CORS_ALLOWED_HEADERS; // CORS allowed headers array
MCP_CORS_EXPOSED_HEADERS; // CORS exposed headers array
MCP_CORS_CONFIG; // Complete CORS config object (methods, allowedHeaders, exposedHeaders)
```

## Companion libraries

| Library                                                                                            | Purpose                                                                                                                                              |
| -------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [`@onivoro/server-mcp-llm-adapter`](https://www.npmjs.com/package/@onivoro/server-mcp-llm-adapter) | Generic LLM adapter — Bedrock Converse, OpenAI, Anthropic, Gemini, Mistral                                                                           |
| [`@onivoro/server-mcp-auth`](https://www.npmjs.com/package/@onivoro/server-mcp-auth)               | Resource server auth — JWT validation, JWKS, scope auto-discovery, RFC 9728 Protected Resource Metadata                                              |
| [`@onivoro/server-mcp-oauth`](https://www.npmjs.com/package/@onivoro/server-mcp-oauth)             | **Deprecated.** Embedded OAuth 2.1 authorization server — wraps the SDK's frozen `mcpAuthRouter` (`@modelcontextprotocol/server-legacy`) into NestJS |

## Peer dependencies

```json
{
  "@modelcontextprotocol/node": "^2.1.1",
  "@modelcontextprotocol/server": "^2.3.1",
  "@nestjs/common": "^10.0.0 || ^11.0.0",
  "@nestjs/core": "^10.0.0 || ^11.0.0",
  "express": "^4.0.0 || ^5.0.0",
  "reflect-metadata": "^0.1.12 || ^0.2.0",
  "zod": "^4.2.0"
}
```

`express` is optional: only its types are used, by `McpHttpModule`. The MCP SDK's v2 packages need Node 20 or later and zod 4.2 or later.

Coming from a version built on `@modelcontextprotocol/sdk` 1.x: see [UPGRADING.md](https://github.com/onivoro/monorepo/blob/main/libs/server/mcp/UPGRADING.md) for every required change and changed default.

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
  async insertEmojis(params: z.infer<typeof insertEmojisSchema>, context?: McpToolContext) {
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
