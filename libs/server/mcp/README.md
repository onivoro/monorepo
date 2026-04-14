# @onivoro/server-mcp

A NestJS module for building MCP (Model Context Protocol) servers using the decorator pattern.

## What this library does

This library handles the infrastructure required to run an MCP server inside a NestJS application: Streamable HTTP transport, session lifecycle management, JSON-RPC 2.0 protocol compliance, automatic tool/resource/prompt discovery, error handling, and graceful shutdown.

On top of that infrastructure, it provides a decorator-based convention for exposing MCP tools, resources, and prompts. The pattern mirrors how NestJS controllers work: you write thin adapter services that map MCP input/output to your existing business logic. The decorators handle registration and protocol wiring.

## What this library is not

This is not a zero-boilerplate "decorate any method and it becomes an MCP tool" solution. MCP tools receive a single `params` object and return structured `content` arrays. Existing service methods have their own signatures and return types. You will need adapter methods that bridge between the two, the same way a NestJS controller bridges between HTTP requests and service calls.

The value is **consistency across MCP servers** (every server in the org works the same way) and **infrastructure you don't think about** (sessions, transport, discovery, cleanup). The decorator pattern is more about convention enforcement than boilerplate elimination.

## Quick start

### 1. Import the module

```typescript
// app.module.ts
import { Module } from '@nestjs/common';
import { McpModule } from '@onivoro/server-mcp';
import { MyMcpService } from './services/my-mcp.service';
import { MyService } from './services/my.service';

@Module({
  imports: [
    McpModule.configure({
      metadata: {
        name: 'my-mcp',
        version: '1.0.0',
        description: 'My MCP server',
      },
    }),
  ],
  providers: [MyMcpService, MyService],
})
export class AppModule {}
```

### 2. Write an MCP adapter service

The adapter service sits between MCP and your existing business logic. Each `@McpTool` method destructures the MCP params, calls your real service, and formats the result.

```typescript
// services/my-mcp.service.ts
import { Injectable } from '@nestjs/common';
import { McpTool } from '@onivoro/server-mcp';
import { z } from 'zod';
import { MyService } from './my.service';

@Injectable()
export class MyMcpService {
  constructor(private readonly myService: MyService) {}

  @McpTool(
    'find-item',
    'Look up an item by ID',
    { id: z.string().describe('Item ID') },
  )
  async findItem(params: { id: string }) {
    const item = await this.myService.findById(params.id);

    if (!item) {
      return { content: [{ type: 'text', text: `No item found with ID ${params.id}` }] };
    }

    return {
      content: [{
        type: 'text',
        text: `**${item.name}** - ${item.description}`,
      }],
    };
  }
}
```

### 3. Bootstrap the app with CORS

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

The MCP endpoint is available at `POST /mcp`.

## Configuration

```typescript
McpModule.configure({
  metadata: {
    name: 'my-server',        // Required. Server name reported to clients.
    version: '1.0.0',         // Required. Server version reported to clients.
    description: 'Optional',  // Optional. Human-readable description.
  },
  routePrefix: 'api/v1',      // Optional. Prefixes the /mcp route (becomes /api/v1/mcp).
  sessionTtlMinutes: 30,      // Optional. Idle session timeout in minutes. Default: 30.
  serverOptions: {},           // Optional. Passed directly to McpServer from @modelcontextprotocol/sdk.
});
```

## Decorators

### @McpTool(name, description, schema?)

Registers a method as an MCP tool. The method receives a single `params` object and should return an MCP content response.

```typescript
@McpTool(
  'tool-name',
  'Human-readable description of what this tool does',
  {
    requiredParam: z.string().describe('Explain the parameter'),
    optionalParam: z.number().optional().describe('This one is optional'),
  },
)
async myTool(params: { requiredParam: string; optionalParam?: number }) {
  return {
    content: [{ type: 'text', text: 'result' }],
  };
}
```

If your method returns a plain string or object instead of `{ content: [...] }`, the library auto-wraps it:
- Strings become `{ content: [{ type: 'text', text: theString }] }`
- Objects become `{ content: [{ type: 'text', text: JSON.stringify(theObject) }] }`

### @McpResource(metadata)

Registers a method as an MCP resource.

```typescript
@McpResource({
  name: 'config',
  uri: 'app://config',
  description: 'Application configuration',
  mimeType: 'application/json',
})
async getConfig() {
  return {
    contents: [{
      uri: 'app://config',
      text: JSON.stringify(this.configService.getAll()),
    }],
  };
}
```

For URI templates, set `isTemplate: true`:

```typescript
@McpResource({
  name: 'item-detail',
  uri: 'item://{id}/detail',
  description: 'Item detail',
  isTemplate: true,
})
async getItemDetail(uri: URL, params: { id: string }) {
  // ...
}
```

### @McpPrompt(metadata)

Registers a method as an MCP prompt template.

```typescript
@McpPrompt({
  name: 'summarize',
  description: 'Generate a summary prompt',
  argsSchema: {
    itemId: z.string().describe('Item ID'),
  },
})
async summarize(params: { itemId: string }) {
  const item = await this.itemService.find(params.itemId);
  return {
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: `Summarize: ${item.content}`,
      },
    }],
  };
}
```

## Adding authentication

Authentication is handled by standard NestJS middleware, not by this library. Apply middleware to the `mcp` route in your app module:

```typescript
@Module({
  imports: [McpModule.configure({ ... })],
  providers: [MyAuthMiddleware, MyMcpService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(MyAuthMiddleware).forRoutes('mcp');
  }
}
```

## CORS

The library exports header constants for MCP protocol compliance. Use them when calling `app.enableCors()`:

| Export | Headers |
|--------|---------|
| `MCP_CORS_ALLOWED_HEADERS` | `Content-Type`, `Accept`, `Authorization`, `x-api-key`, `Mcp-Session-Id`, `Mcp-Protocol-Version`, `Last-Event-ID` |
| `MCP_CORS_EXPOSED_HEADERS` | `Mcp-Session-Id`, `Mcp-Protocol-Version` |

## Session management

Each MCP client connection creates a session. Sessions are identified by the `Mcp-Session-Id` header and tracked server-side.

- Sessions are created on the first `POST /mcp` (the `initialize` handshake).
- Sessions are destroyed on `DELETE /mcp` or when the idle TTL expires.
- The default idle TTL is 30 minutes, configurable via `sessionTtlMinutes`.
- All sessions are cleaned up on application shutdown.

## Duplicate detection

Tool, resource, and prompt names must be unique across all providers in the module. Registering a duplicate name throws at startup with a clear error message, rather than failing silently at request time.

## Exports

```typescript
// Module and service
McpModule                    // NestJS dynamic module — use McpModule.configure()
McpService                   // Injectable service (rarely needed directly)

// Decorators
McpTool                      // Method decorator for tools
McpResource                  // Method decorator for resources
McpPrompt                    // Method decorator for prompts

// Interfaces
McpModuleConfig              // Configuration for McpModule.configure()
McpServerMetadata            // Server name/version/description
McpToolMetadata              // Tool registration metadata
McpResourceMetadata          // Resource registration metadata
McpPromptMetadata            // Prompt registration metadata

// Constants
MCP_MODULE_CONFIG            // DI token (internal use)
MCP_TOOL_METADATA            // Reflect metadata key (internal use)
MCP_RESOURCE_METADATA        // Reflect metadata key (internal use)
MCP_PROMPT_METADATA          // Reflect metadata key (internal use)
MCP_CORS_ALLOWED_HEADERS     // CORS allowed headers array
MCP_CORS_EXPOSED_HEADERS     // CORS exposed headers array
```
