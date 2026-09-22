# @onivoro/server-mcp-audit

Audit interception for MCP tool calls: who called what, with which arguments,
and how it ended.

Registers a single interceptor with the
[`@onivoro/server-mcp`](https://www.npmjs.com/package/@onivoro/server-mcp)
registry, which composes its interceptor chain per execution. Coverage is
therefore not a list captured at startup: a tool registered later is audited
too, without anything having to notice it appeared.

## Installation

```bash
npm install @onivoro/server-mcp-audit @onivoro/server-mcp
```

## Wiring

```ts
import { createMcpAuditProviders } from '@onivoro/server-mcp-audit';

@Module({
  providers: [
    ...createMcpAuditProviders({
      sink: MyAuditSink,
      eventResolver: MyEventResolver,
      // emailResolver defaults to McpAuthInfoEmailResolver
    }),
  ],
})
export class AppModule {}
```

One interceptor covers the whole registry, so a tool added later — by a
dynamically loaded module, say — is not a hole.

## What you supply

Three seams. `sink` and `eventResolver` are required; `emailResolver` defaults
to `McpAuthInfoEmailResolver`:

- **`McpAuditSink`** — where records go. A database table, a log stream, a
  queue. This package does not choose for you and does not write anywhere by
  default.
- **`McpAuditEmailResolver`** _(optional)_ — turns the verified auth context
  into an actor identity. The default reads a claim off the token; replace it
  when identity lives somewhere else.
- **`McpAuditEventResolver`** — derives the domain meaning of a call: what kind
  of resource it touched, which record, whether it read or wrote. This is the
  part only your application knows, which is why it is a seam rather than a
  heuristic over tool names.

## What a record carries

Tool name, resolved actor, the arguments (as your resolver chooses to
summarize them), the outcome — success, tool error, or thrown — and the
duration.

Redaction is the resolver's job, not this package's. It cannot know which of
your arguments are sensitive, and guessing from key names would be a guess.

## License

MIT
