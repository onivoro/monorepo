# @onivoro/create-mcp-server

Scaffold a NestJS MCP server project in seconds. One command gives you a fully configured application with transport, auth, and tool boilerplate ready to go.

## Quick start

```bash
npx @onivoro/create-mcp-server
```

You'll be prompted for:

1. **Project name** — kebab-case npm package name
2. **Transport** — `http` (Streamable HTTP), `stdio`, or `both`
3. **JWT auth** — include [`@onivoro/server-mcp-auth`](https://www.npmjs.com/package/@onivoro/server-mcp-auth) (only for HTTP/both)

## CLI flags

Skip prompts entirely or pre-fill values:

```bash
# Accept all defaults (http, no auth)
npx @onivoro/create-mcp-server --yes

# Set project name
npx @onivoro/create-mcp-server my-server
npx @onivoro/create-mcp-server --name my-server

# Choose transport
npx @onivoro/create-mcp-server --transport stdio

# Enable JWT auth
npx @onivoro/create-mcp-server --auth

# Combine flags
npx @onivoro/create-mcp-server -y --name my-server --transport both --auth
```

| Flag                              | Description                |
| --------------------------------- | -------------------------- |
| `--yes`, `-y`                     | Skip prompts, use defaults |
| `--name <name>`                   | Set project name           |
| `--transport <http\|stdio\|both>` | Set transport type         |
| `--auth`                          | Include JWT auth module    |

A positional argument is treated as the project name: `npx @onivoro/create-mcp-server my-app`.

`--oauth` has been removed, along with the embedded OAuth server it added (`@onivoro/server-mcp-oauth`, which is deprecated). Passing it stops the CLI with an explanation. Use `--auth` instead, with a dedicated authorization server whose tokens `@onivoro/server-mcp-auth` validates.

## Generated project structure

```
my-server/
  package.json
  tsconfig.json
  .gitignore
  .env.example        # only when auth is enabled
  src/
    main.ts
    app.module.ts
    tools/
      example.tool.ts
    resources/
      example.resource.ts
    prompts/
      example.prompt.ts
```

## What gets generated

### `main.ts`

- **HTTP / both**: `NestFactory.create()` with CORS enabled, listens on port 3000
- **stdio**: `NestFactory.createApplicationContext()` for subprocess usage, with `McpStderrLogger` so logs stay off the protocol stream on stdout

### `app.module.ts`

Configured based on your selections:

```typescript
// Example: HTTP + auth
import { Module } from '@nestjs/common';
import { McpHttpModule } from '@onivoro/server-mcp';
import { McpAuthModule, McpJwtAuthStrategy } from '@onivoro/server-mcp-auth';
import { ExampleToolService } from './tools/example.tool';
import { ExampleResourceService } from './resources/example.resource';
import { ExamplePromptService } from './prompts/example.prompt';

@Module({
  imports: [
    McpAuthModule.configureJwt({
      jwksUri: process.env.JWKS_URI!,
      issuer: process.env.JWT_ISSUER!,
      audience: process.env.JWT_AUDIENCE!,
      resourceServerUrl: process.env.MCP_RESOURCE_URL!,
    }),
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '0.0.1' },
      authStrategy: McpJwtAuthStrategy,
      requireBearerAuth: true,
      exposeErrorMessages: false,
    }),
  ],
  providers: [ExampleToolService, ExampleResourceService, ExamplePromptService],
})
export class AppModule {}
```

Generated modules set `exposeErrorMessages: false`, so clients only see the messages of errors you throw as `McpToolError` (and argument validation errors); other errors reach them as `Internal error` and are logged in full on the server.

With stdio only, there is no HTTP route to describe, so the generated `McpAuthModule` sets `serveProtectedResourceMetadata: false` instead of `resourceServerUrl`, and there is no `requireBearerAuth`.

### `example.tool.ts`

A sample tool to verify the server works:

```typescript
import { Injectable } from '@nestjs/common';
import { McpTool } from '@onivoro/server-mcp';
import { z } from 'zod';

const helloSchema = z.object({
  name: z.string().describe('The name to greet'),
});

@Injectable()
export class ExampleToolService {
  @McpTool({ name: 'hello', description: 'Says hello to a name', schema: helloSchema })
  async hello(params: z.infer<typeof helloSchema>) {
    return `Hello, ${params.name}!`;
  }
}
```

## After scaffolding

```bash
cd my-server
npm install

# If auth is enabled:
cp .env.example .env   # configure JWKS_URI, JWT_ISSUER, JWT_AUDIENCE, MCP_RESOURCE_URL

# HTTP transport:
npm run start:dev

# stdio transport:
npm run build
# Then add to your MCP client config as a stdio server
```

## Companion libraries

- [`@onivoro/server-mcp`](https://www.npmjs.com/package/@onivoro/server-mcp) — Core MCP library with decorators, transports, and registry
- [`@onivoro/server-mcp-auth`](https://www.npmjs.com/package/@onivoro/server-mcp-auth) — JWT authentication for MCP HTTP servers
- [`@onivoro/server-mcp-llm-adapter`](https://www.npmjs.com/package/@onivoro/server-mcp-llm-adapter) — LLM provider adapters (Bedrock, OpenAI, Anthropic)
