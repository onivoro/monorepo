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
4. **OAuth server** — include [`@onivoro/server-mcp-oauth`](https://www.npmjs.com/package/@onivoro/server-mcp-oauth) (only when auth is enabled)

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

# Enable auth and OAuth
npx @onivoro/create-mcp-server --auth --oauth

# Combine flags
npx @onivoro/create-mcp-server -y --name my-server --transport both --auth
```

| Flag | Description |
|------|-------------|
| `--yes`, `-y` | Skip prompts, use defaults |
| `--name <name>` | Set project name |
| `--transport <http\|stdio\|both>` | Set transport type |
| `--auth` | Include JWT auth module |
| `--oauth` | Include OAuth module (implies `--auth`) |

A positional argument is treated as the project name: `npx @onivoro/create-mcp-server my-app`.

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
- **stdio**: `NestFactory.createApplicationContext()` for subprocess usage

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
    McpAuthModule.register({
      jwksUri: process.env.JWKS_URI!,
      issuer: process.env.JWT_ISSUER,
      audience: process.env.JWT_AUDIENCE,
    }),
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '0.0.1' },
      authStrategy: McpJwtAuthStrategy,
    }),
  ],
  providers: [ExampleToolService, ExampleResourceService, ExamplePromptService],
})
export class AppModule {}
```

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
cp .env.example .env   # configure JWKS_URI, JWT_ISSUER, JWT_AUDIENCE

# HTTP transport:
npm run start:dev

# stdio transport:
npm run build
# Then add to your MCP client config as a stdio server
```

## Companion libraries

- [`@onivoro/server-mcp`](https://www.npmjs.com/package/@onivoro/server-mcp) — Core MCP library with decorators, transports, and registry
- [`@onivoro/server-mcp-auth`](https://www.npmjs.com/package/@onivoro/server-mcp-auth) — JWT authentication for MCP HTTP servers
- [`@onivoro/server-mcp-oauth`](https://www.npmjs.com/package/@onivoro/server-mcp-oauth) — Embedded OAuth 2.1 authorization server
- [`@onivoro/server-mcp-llm-adapter`](https://www.npmjs.com/package/@onivoro/server-mcp-llm-adapter) — LLM provider adapters (Bedrock, OpenAI, Anthropic)
