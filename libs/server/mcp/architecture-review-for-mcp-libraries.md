# MCP Library Audit: Spec Compliance, Integrity, and Gap Analysis

**Date**: 2026-04-20
**Libraries Analyzed**:
1. `@onivoro/server-mcp` v24.33.21 — MCP protocol server for NestJS
2. `@onivoro/server-mcp-llm-adapter` v24.33.21 — LLM provider tool format adapter

**MCP Spec Version**: 2025-11-25 (third major revision)
**SDK Version Installed**: `@modelcontextprotocol/sdk ^1.28.0` (latest stable: 1.29.0)

---

## Integrity Issues (Bugs / Correctness Problems)

### 1. `McpToolOptions` detection is fragile

**File**: `mcp.decorator.ts:100`

```ts
if (aliasesOrOptions && ('aliases' in aliasesOrOptions || 'annotations' in aliasesOrOptions || 'title' in aliasesOrOptions))
```

If someone passes `{ outputSchema: z.object({...}) }` without any of the three checked keys, it falls into the positional branch and the `outputSchema` is silently treated as an `aliases` `Record<string, string>`. The check must include `'outputSchema' in aliasesOrOptions`.

**Severity**: HIGH — silent data corruption of metadata.

---

### 2. `description` not passed to McpServer constructor

**Files**: `mcp.service.ts:47`, `mcp-stdio.module.ts:67`

```ts
const server = new McpServer(
  { name: this.config.metadata.name, version: this.config.metadata.version },
  ...
);
```

`McpServerMetadata` has a `description` field, but it's never forwarded to the SDK's `ServerInfo`. Clients that display server descriptions will see nothing.

**Severity**: LOW — cosmetic, but easy fix.

---

### 3. `buildCapabilities` hardcodes `logging: {}` unconditionally

**File**: `wire-registry-to-server.ts:11`

The MCP spec says servers advertise `logging` capability only if they support it. The implementation always advertises it, which is technically correct (logging is always wired), but in registry-only setups (no transport) this advertises a capability that can't deliver. Minor, but misleading for introspection consumers.

**Severity**: LOW.

---

### 4. Express-only HTTP transport

**File**: `mcp.module.ts:22`

```ts
@All(route)
async handleMcp(@Req() req: Request, @Res() res: Response) {
  await this.mcpService.handleRequest(req as any, res as any);
}
```

The controller uses Express `Request`/`Response` types. The SDK's `StreamableHTTPServerTransport.handleRequest` expects raw Node HTTP objects. This works because Express objects are supersets of `http.IncomingMessage`/`http.ServerResponse`, but:
- `(req as any).body` depends on Express body-parsing middleware. If the NestJS app uses Fastify platform or a raw body parser, this breaks silently.
- No validation that the body is parsed JSON.

**Severity**: MEDIUM — breaks on NestJS Fastify platform without error.

---

### 5. Resource subscription handlers have no logging for missing sessionId

**File**: `wire-registry-to-server.ts:154-170`

The subscribe/unsubscribe handlers only act when both `uri` and `sessionId` are present. A missing `sessionId` (transport bug) goes completely undetected — no log, no error. Per spec this is acceptable (subscribe should not fail), but silent drops make debugging hard.

**Severity**: LOW.

---

### 6. `LlmToolAdapter.buildNameMap()` rebuilds on every call

**File**: `llm-tool-adapter.ts:17-23`

O(n) on every `executeToolForProvider` and `resolveProviderToolName` call. Not a bug, but a scaling issue for servers with many tools under high call frequency.

**Severity**: LOW (performance).

---

## Spec Gaps: MCP 2025-11-25

### HIGH PRIORITY

| Gap | Spec Requirement | Current State |
|-----|-----------------|---------------|
| **Prompt argument completions** | `completion/complete` with `ref: { type: "ref/prompt" }` allows clients to get autocomplete suggestions for prompt arguments | `@McpPrompt` has no completion support. Resource template completions work via `completeCallbacks`, but prompts have no equivalent. |
| **`icons` field** | Tools, resources, and prompts can have `icons: Array<{ url, mediaType?, size? }>` for client UI rendering | Not in metadata types. Added in 2025-11-25 spec. |
| **Async module factories** | Production configs often come from environment/secrets at runtime | Both modules only accept static config. No `registerAndServeHttpAsync({ useFactory, inject })` pattern. |

### MEDIUM PRIORITY

| Gap | Spec Requirement | Current State |
|-----|-----------------|---------------|
| **Resource `annotations`** | Resources can have `audience`, `priority`, and `lastModified` annotations | Not exposed in `McpResourceMetadata`. |
| **Tasks (experimental)** | Long-running tools return `CreateTaskResult`. Status polling, cancellation, notifications via `ExperimentalServerTasks`. | Not implemented. Experimental in SDK. |
| **Resumability config** | SSE streams can have event IDs. Client reconnects with `Last-Event-ID` for replay. SDK supports with event store config. | Not exposed in module config. |
| **Sampling with tools** | `sampling/createMessage` can include a `tools` array and `toolChoice` for multi-turn agentic loops | `createMessage` is a raw passthrough (`Record<string, unknown>`), which works but provides no typed helper. |
| **`MCP-Protocol-Version` validation** | After init, clients include `MCP-Protocol-Version` header. Server should validate. | Header is in CORS allowed list but not validated by `McpService`. SDK transport likely handles this internally. |

### LOW PRIORITY

| Gap | Spec Requirement | Current State |
|-----|-----------------|---------------|
| **URL-mode elicitation notifications** | `notifications/elicitation/complete` for URL-mode flows | Passthrough via `elicitInput` callback; SDK handles internally. |
| **Error code `-32002`** | `ResourceNotFound` for unknown resource URIs | Delegated to SDK. |
| **`ping`** | Server responds to `ping` requests | Handled by SDK's low-level `Server` automatically. |
| **Cancellation notification** | Client sends `notifications/cancelled` with `requestId` | Handled by SDK via `AbortSignal`. Correctly exposed as `signal` on `McpToolContext`. |

---

## Features Confirmed Working

| Feature | Implementation |
|---------|---------------|
| Tools (input schema, output schema, annotations, aliases) | `@McpTool` decorator + registry |
| Resources (static + templates with completion) | `@McpResource` decorator + `completeCallbacks` |
| Prompts | `@McpPrompt` decorator |
| Progress reporting | `sendProgress` on `McpToolContext` |
| Logging | `sendLog` on `McpToolContext` |
| Sampling | `createMessage` on `McpToolContext` |
| Elicitation | `elicitInput` on `McpToolContext` |
| Roots listing | `listRoots` on `McpToolContext` |
| Resource subscriptions | `subscribeResource` / `notifyResourceUpdated` |
| Tool enable/disable | `setToolEnabled` + delegate pattern |
| OAuth 2.1 auth flow | `McpAuthInfo` with scopes, resource indicator |
| Cancellation | `AbortSignal` forwarding |
| DNS rebinding protection | `allowedOrigins` config |
| Dynamic registration | `onRegistrationChange` + `listChanged` capability |
| Pagination | Delegated to SDK (handles internally) |
| Guards (authorization) | `@McpGuard` decorator, `McpScopeGuard` built-in |
| Interceptors | Onion-model `McpToolInterceptor` chain |
| Multiple content types | `McpContentBlock` union (text, image, audio, resource, resource_link) |
| Structured output | `outputSchema` + `structuredContent` in results |
| Server instructions | `metadata.instructions` merged into `ServerOptions` |

---

## Architectural Observations

### Strengths

1. **Transport-agnostic registry** — Clean separation. Tools defined once, consumed via HTTP, stdio, or LLM adapter.
2. **NestJS-idiomatic pipeline** — Guards, interceptors, and DI compose naturally with the rest of a NestJS application.
3. **Dynamic wiring** — `onRegistrationChange` + `wireRegistryToServer` enables hot-registration after init.
4. **Enable/disable delegate** — Avoids leaking SDK-specific `RegisteredTool` types into the transport-agnostic registry.
5. **Session subscription cleanup** — Proper memory leak prevention on disconnect.
6. **LLM adapter** — Elegant "define once, consume everywhere" with per-provider aliases and name sanitization.

### Design Concerns

1. **Single McpServer per session in HTTP mode** — Each session creates its own `McpServer` + `wireRegistryToServer`. With 100 concurrent sessions, that's 100 sets of registered tools/resources/prompts and 100 entries in the registry's change listener array. O(sessions x registrations).

2. **No auth extraction middleware** — `authInfo` comes from the SDK transport's `extra.authInfo`, but there's no hook to inject custom auth logic (validate JWT, hydrate user) without writing a guard. A dedicated auth middleware would reduce per-tool boilerplate.

3. **CORS config exported but not auto-applied** — `MCP_CORS_CONFIG` is exported as a constant, but consumers must manually apply it. Could be auto-configured by the HTTP module.

4. **Express-only** — The SDK provides `WebStandardStreamableHTTPServerTransport` for non-Express runtimes. NestJS Fastify users cannot use `McpHttpModule` without modification.

---

## LLM Adapter Gaps

| Issue | Detail |
|-------|--------|
| **No output schema forwarding** | Some LLM APIs (OpenAI `response_format`, Claude `tool_result_schema`) support structured output validation. Adapter only forwards `inputSchema`. |
| **No streaming support** | `executeToolForProvider` returns a complete string. No incremental path for streaming tool results. |
| **No tool-call-id handling** | LLM APIs (OpenAI, Claude) require correlating tool calls to responses via IDs. Adapter doesn't help with this. |
| **No batch execution** | LLMs can request multiple tool calls in one turn. No `executeMultiple` method. |
| **Bedrock name sanitization too narrow** | `replace(/-/g, '_')` handles hyphens but not dots, colons, or spaces. Bedrock requires `[a-zA-Z0-9_]+`. |
| **Name map not cached** | `buildNameMap()` is O(n) on every call. Should cache and invalidate on registration change. |

---

## Recommended Actions

### Critical (correctness)

1. Fix `McpToolOptions` detection to include `'outputSchema'` in the check
2. Pass `description` from `McpServerMetadata` to `McpServer()` constructor

### High (spec compliance / production readiness)

3. Add `icons` support to `McpToolMetadata`, `McpResourceMetadata`, `McpPromptMetadata`
4. Add async module factory methods (`registerAndServeHttpAsync`, `registerAndServeStdioAsync`)
5. Add prompt argument completion callback support to `@McpPrompt`

### Medium (improvements)

6. Cache `buildNameMap()` in LLM adapter (invalidate on registry `onRegistrationChange`)
7. Expand Bedrock name sanitization to strip all non-`[a-zA-Z0-9_]` characters
8. Add resource `annotations` (audience, priority, lastModified) to `McpResourceMetadata`
9. Document or enforce Express-only requirement for `McpHttpModule`
10. Add batch `executeToolsForProvider` method to LLM adapter

### Low (nice to have / defer)

11. Resumability config passthrough (event store option)
12. Tasks support (wait for SDK to stabilize experimental API)
13. Auto-apply CORS in HTTP module
14. Add auth extraction middleware hook

---

## Verification Notes

- Pagination: Confirmed handled internally by SDK's `McpServer.registerTool/Resource/Prompt`
- Completions capability: SDK advertises automatically when resource templates have completion callbacks
- `ping`: Handled by SDK's low-level `Server` class
- Cancellation: SDK propagates via `AbortSignal` — correctly forwarded to `McpToolContext.signal`
- `logging/setLevel`: SDK handles internally; `sendLog` respects the client-set level
