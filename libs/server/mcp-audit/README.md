# @onivoro/server-mcp-audit

Audit interception for MCP tool calls: who called which tool, and what it
touched.

Registers a single interceptor with the
[`@onivoro/server-mcp`](https://www.npmjs.com/package/@onivoro/server-mcp)
registry, which composes its interceptor chain per execution. Coverage is
therefore not a list captured at startup: a tool registered later is audited
too, without anything having to notice it appeared.

## Installation

```bash
npm install @onivoro/server-mcp-audit @onivoro/server-mcp
```

**Peer dependencies:** `@nestjs/common`, `@onivoro/server-mcp`

## Wiring

`createMcpAuditProviders()` returns the providers to spread into a module.
That module must be able to inject `McpToolRegistry`, so import
`McpHttpModule`, `McpStdioModule`, or `McpRegistryModule` there (all three
export it).

```ts
import { Module } from '@nestjs/common';
import { McpHttpModule } from '@onivoro/server-mcp';
import { createMcpAuditProviders } from '@onivoro/server-mcp-audit';

@Module({
  imports: [
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '1.0.0' },
    }),
  ],
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

On module init, `McpAuditInterceptorRegistrar` calls
`registry.registerInterceptor()` with `McpAuditInterceptor`. One interceptor
covers the whole registry, so a tool added later — by a dynamically loaded
module, say — is not a hole.

The resolver and sink classes are registered as providers and bound to the
`MCP_AUDIT_EMAIL_RESOLVER`, `MCP_AUDIT_EVENT_RESOLVER`, and `MCP_AUDIT_SINK`
tokens with `useExisting`.

## What you supply

Three seams. `sink` and `eventResolver` are required; `emailResolver` defaults
to `McpAuthInfoEmailResolver`:

- **`McpAuditSink`** — where records go. A database table, a log stream, a
  queue. This package does not choose for you and does not write anywhere by
  default. `writeAuditEvent(event: McpAuditEvent): Promise<void> | void`.
- **`McpAuditEmailResolver`** _(optional)_ — turns the verified auth context
  into an actor identity:
  `resolveEmail(context: McpToolContext): Promise<string | undefined> | string | undefined`.
  The default, `McpAuthInfoEmailResolver`, returns `context.authInfo.extra.email`
  when it is a non-empty string. With `@onivoro/server-mcp-auth` that means
  mapping a claim into `extra`, e.g. `extraClaims: { email: 'email' }`. Replace
  it when identity lives somewhere else.
- **`McpAuditEventResolver`** — derives the domain meaning of a call: what kind
  of resource it touched, which records, and how it was accessed:
  `resolveAuditEvent(context, result): Promise<McpResolvedAuditEvent | undefined> | McpResolvedAuditEvent | undefined`,
  where `McpResolvedAuditEvent` is `{ accessType: string; resourceType: string; resourceIds?: Array<string | number | null | undefined> }`.
  This is the part only your application knows, which is why it is a seam
  rather than a heuristic over tool names.

```ts
import { Injectable } from '@nestjs/common';
import type { McpToolContext } from '@onivoro/server-mcp';
import { McpAuditEvent, McpAuditEventResolver, McpAuditSink, McpResolvedAuditEvent } from '@onivoro/server-mcp-audit';

@Injectable()
export class MyEventResolver implements McpAuditEventResolver {
  resolveAuditEvent(context: McpToolContext): McpResolvedAuditEvent | undefined {
    if (context.toolName === 'get-invoice') {
      return {
        accessType: 'read',
        resourceType: 'invoice',
        resourceIds: [context.params['invoiceId'] as string],
      };
    }
    return undefined; // not audited
  }
}

@Injectable()
export class MyAuditSink implements McpAuditSink {
  async writeAuditEvent({ context, ...record }: McpAuditEvent) {
    // context carries params, authInfo (including the raw token), sessionId, ...
    console.log(JSON.stringify(record));
  }
}
```

## What a record carries

`McpAuditEvent`:

| Field                        | Source                                                                                        |
| ---------------------------- | --------------------------------------------------------------------------------------------- |
| `accessEmail`                | the email resolver                                                                            |
| `accessType`, `resourceType` | the event resolver                                                                            |
| `resourceIds`                | the event resolver, with `null`/`undefined` entries removed (defaults to `[]`)                |
| `toolName`                   | `context.toolName`                                                                            |
| `context`                    | the full `McpToolContext`: validated `params`, `metadata`, `authInfo`, `sessionId`, and so on |

When a record is written:

- Only after the tool handler (and any inner interceptors) returns. A call
  that throws, including one rejected by a guard or schema validation, is not
  audited. A returned result that represents a tool error is still passed to
  the event resolver as `result`.
- Only when the email resolver returns an email **and** the event resolver
  returns an event. Either returning `undefined` skips the record.
- Failures in the resolvers or the sink are logged as a warning and swallowed;
  they never change the tool's result.

There is no outcome or duration field.

Redaction is the sink's and resolver's job, not this package's. The sink gets
the whole `context`, including the arguments and `authInfo.token`, and this
package cannot know which of them are sensitive.

## Exports

| Export                                                                   | Kind       | Description                                                                                                             |
| ------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `createMcpAuditProviders(config)`                                        | Function   | Returns the `Provider[]` described above                                                                                |
| `CreateMcpAuditProvidersConfig`                                          | Interface  | `{ sink: Type<McpAuditSink>; eventResolver: Type<McpAuditEventResolver>; emailResolver?: Type<McpAuditEmailResolver> }` |
| `McpAuditSink`, `McpAuditEvent`                                          | Interfaces | Sink contract and the record it receives                                                                                |
| `McpAuditEventResolver`, `McpResolvedAuditEvent`                         | Interfaces | Event resolver contract and its return type                                                                             |
| `McpAuditEmailResolver`                                                  | Interface  | Actor resolver contract                                                                                                 |
| `McpAuthInfoEmailResolver`                                               | Service    | Default email resolver (`authInfo.extra.email`)                                                                         |
| `McpAuditInterceptor`                                                    | Service    | The `McpToolInterceptor` that writes records                                                                            |
| `McpAuditInterceptorRegistrar`                                           | Service    | Registers the interceptor with `McpToolRegistry` on init                                                                |
| `MCP_AUDIT_SINK`, `MCP_AUDIT_EVENT_RESOLVER`, `MCP_AUDIT_EMAIL_RESOLVER` | Symbols    | Injection tokens                                                                                                        |

## License

MIT
