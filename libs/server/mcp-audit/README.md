# @onivoro/server-mcp-audit

Audit interception for MCP tool calls: who called which tool, what it
touched, and how the call ended — including calls that failed or were denied.

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
  `resolveAuditEvent(context, result, outcome): Promise<McpResolvedAuditEvent | undefined> | McpResolvedAuditEvent | undefined`,
  where `McpResolvedAuditEvent` is `{ accessType: string; resourceType: string; resourceIds?: Array<string | number | null | undefined> }`.
  `result` is what the tool returned (`undefined` when it threw or never ran),
  and `outcome` is how the call ended (see below).
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
    // context carries params, authInfo (without the token), sessionId, ...
    console.log(JSON.stringify(record));
  }
}
```

## What a record carries

`McpAuditEvent`:

| Field                        | Source                                                                                                          |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `accessEmail`                | the email resolver                                                                                              |
| `accessType`, `resourceType` | the event resolver                                                                                              |
| `resourceIds`                | the event resolver, with `null`/`undefined` entries removed (defaults to `[]`)                                  |
| `toolName`                   | `context.toolName`                                                                                              |
| `outcome`                    | how the call ended: `'success'`, `'error'`, `'denied'` or `'rejected'` (below)                                  |
| `error`                      | for any outcome but `'success'`: the error message, or the text of an `isError` result                          |
| `context`                    | the `McpToolContext` (`params`, `metadata`, `authInfo`, `sessionId`, and so on), with `authInfo.token` left out |

`McpAuditOutcome`:

| Outcome      | When                                                                                             |
| ------------ | ------------------------------------------------------------------------------------------------ |
| `'success'`  | The tool returned a result                                                                       |
| `'error'`    | The tool (or an interceptor inside this one) threw, or returned a result with `isError: true`    |
| `'denied'`   | A guard rejected the call (`McpAccessDeniedError`), so the tool never ran                        |
| `'rejected'` | The auth strategy rejected the caller, or the arguments failed validation, so the tool never ran |

When a record is written:

- After the call ends, however it ends. A tool that returns `inputRequired(...)`
  hasn't ended: the client answers and calls it again, and only that call is
  recorded. Successes and errors are recorded by
  the interceptor around the tool; denied and rejected calls, which never
  reach the interceptor chain, through its `onRejected` hook. For those two,
  `context.params` holds the arguments as received, not validated. When the
  auth strategy is what rejected the caller, `context.authInfo` is the auth
  info the call arrived with (over HTTP with `requireBearerAuth`, the token the
  transport verified), or unset if there was none.
- Only when the email resolver returns an email **and** the event resolver
  returns an event. Either returning `undefined` skips the record. The default
  email resolver reads `authInfo.extra.email`, so a caller the auth strategy
  rejected is recorded only if the auth info it arrived with already carries
  an email.
- Failures in the resolvers or the sink are logged as a warning and swallowed;
  they never change the tool's result, and a failed call still fails with its
  original error.

There is no duration field.

The sink never sees the bearer token: `context.authInfo` is passed without it.
The resolvers get the full `McpToolContext`, token included, since they run in
your process to derive identity. Any other redaction, such as of sensitive
arguments, is the sink's and resolver's job; this package cannot know which
arguments are sensitive.

## Exports

| Export                                                                   | Kind       | Description                                                                                                             |
| ------------------------------------------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------- |
| `createMcpAuditProviders(config)`                                        | Function   | Returns the `Provider[]` described above                                                                                |
| `CreateMcpAuditProvidersConfig`                                          | Interface  | `{ sink: Type<McpAuditSink>; eventResolver: Type<McpAuditEventResolver>; emailResolver?: Type<McpAuditEmailResolver> }` |
| `McpAuditSink`, `McpAuditEvent`                                          | Interfaces | Sink contract and the record it receives                                                                                |
| `McpAuditOutcome`, `McpAuditContext`                                     | Types      | How a call ended; the tool context without the bearer token                                                             |
| `McpAuditEventResolver`, `McpResolvedAuditEvent`                         | Interfaces | Event resolver contract and its return type                                                                             |
| `McpAuditEmailResolver`                                                  | Interface  | Actor resolver contract                                                                                                 |
| `McpAuthInfoEmailResolver`                                               | Service    | Default email resolver (`authInfo.extra.email`)                                                                         |
| `McpAuditInterceptor`                                                    | Service    | The `McpToolInterceptor` that writes records, including from `onRejected`                                               |
| `McpAuditInterceptorRegistrar`                                           | Service    | Registers the interceptor with `McpToolRegistry` on init                                                                |
| `MCP_AUDIT_SINK`, `MCP_AUDIT_EVENT_RESOLVER`, `MCP_AUDIT_EMAIL_RESOLVER` | Symbols    | Injection tokens                                                                                                        |

## License

MIT
