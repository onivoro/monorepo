# MCP Library Audit: Spec Compliance, Integrity, and Gap Analysis

**Date**: 2026-04-20
**Libraries Analyzed**:
1. `@onivoro/server-mcp` v24.33.21 — MCP protocol server for NestJS
2. `@onivoro/server-mcp-llm-adapter` v24.33.21 — LLM provider tool format adapter

**MCP Spec Version**: 2025-11-25 (third major revision)
**SDK Version Installed**: `@modelcontextprotocol/sdk ^1.28.0` (latest stable: 1.29.0)

---

## Integrity Issues (Bugs / Correctness Problems)

### ~~1. `McpToolOptions` detection is fragile~~ RESOLVED

**File**: `mcp.decorator.ts:100`

The `in` check now includes all `McpToolOptions` keys: `aliases`, `annotations`, `title`, `outputSchema`, and `icons`. Options objects with any recognized key are correctly routed to the options branch.

---

### ~~2. `description` not passed to McpServer constructor~~ RESOLVED

**Files**: `mcp.service.ts`, `mcp-stdio.module.ts`

Both modules now forward `metadata.description` to the SDK's `McpServer` constructor via conditional spread.

---

### ~~3. `buildCapabilities` hardcodes `logging: {}` unconditionally~~ RESOLVED

**File**: `wire-registry-to-server.ts:11`

`buildCapabilities` now accepts an optional `options` parameter with a `logging` flag (defaults to `true`). Transport modules (HTTP, stdio) get logging advertised automatically. Registry-only consumers can pass `{ logging: false }` to avoid advertising a capability that no transport can deliver. JSDoc documents the intended usage.

---

### ~~4. Express-only HTTP transport~~ RESOLVED

**File**: `mcp.module.ts`

The controller now includes a runtime guard that returns a clear JSON-RPC error when `req.body` is undefined (Fastify platform, missing body parser). JSDoc on `McpHttpModule` documents the Express-only requirement and recommends `McpRegistryModule.registerOnly()` for Fastify users. README includes a "Platform requirement" section.

---

### ~~5. Resource subscription handlers have no logging for missing sessionId~~ RESOLVED

**File**: `wire-registry-to-server.ts:159-175`

Subscribe and unsubscribe handlers now log a warning via NestJS `Logger` when `sessionId` is missing. The handlers still return `{}` (per spec, subscribe should not fail), but missing session IDs are no longer silently swallowed — transport bugs are now visible in logs.

---

### ~~6. `LlmToolAdapter.buildNameMap()` rebuilds on every call~~ RESOLVED

**File**: `llm-tool-adapter.ts`

The name map is now cached and automatically invalidated when the registry fires a registration change event. The adapter implements `OnModuleInit` to subscribe to the registry's `onRegistrationChange` listener.

---

## Spec Gaps: MCP 2025-11-25

### HIGH PRIORITY

| Gap | Spec Requirement | Status |
|-----|-----------------|--------|
| ~~**Prompt argument completions**~~ | `completion/complete` with `ref: { type: "ref/prompt" }` allows clients to get autocomplete suggestions for prompt arguments | **RESOLVED** — `McpPromptMetadata.completeCallbacks` added, wired to SDK's `registerPrompt` as `complete` config. |
| ~~**`icons` field**~~ | Tools, resources, and prompts can have `icons: Array<{ url, mediaType?, size? }>` for client UI rendering | **RESOLVED** — `McpIcon` interface added. `icons` supported on `McpToolMetadata`, `McpResourceMetadata`, `McpPromptMetadata`, and `McpToolOptions`. All wired through to SDK registration. |
| ~~**Async module factories**~~ | Production configs often come from environment/secrets at runtime | **RESOLVED** — `registerAndServeHttpAsync()` and `registerAndServeStdioAsync()` added with `{ imports, inject, useFactory }` pattern. `McpModuleAsyncOptions` and `McpStdioAsyncOptions` exported. |

### MEDIUM PRIORITY

| Gap | Spec Requirement | Status |
|-----|-----------------|--------|
| ~~**Resource `annotations`**~~ | Resources can have `audience`, `priority`, and `lastModified` annotations | **RESOLVED** — `McpResourceAnnotations` interface added to `McpResourceMetadata`. Wired through to SDK resource config. |
| **Tasks (experimental)** | Long-running tools return `CreateTaskResult`. Status polling, cancellation, notifications via `ExperimentalServerTasks`. | Not implemented. Experimental in SDK — defer until stable. |
| **Resumability config** | SSE streams can have event IDs. Client reconnects with `Last-Event-ID` for replay. SDK supports with event store config. | Not exposed in module config. |
| **Sampling with tools** | `sampling/createMessage` can include a `tools` array and `toolChoice` for multi-turn agentic loops | `createMessage` is a raw passthrough (`Record<string, unknown>`), which works but provides no typed helper. |
| **`MCP-Protocol-Version` validation** | After init, clients include `MCP-Protocol-Version` header. Server should validate. | Header is in CORS allowed list but not validated by `McpService`. SDK transport likely handles this internally. |

### LOW PRIORITY

| Gap | Spec Requirement | Status |
|-----|-----------------|--------|
| **URL-mode elicitation notifications** | `notifications/elicitation/complete` for URL-mode flows | Passthrough via `elicitInput` callback; SDK handles internally. |
| **Error code `-32002`** | `ResourceNotFound` for unknown resource URIs | Delegated to SDK. |
| **`ping`** | Server responds to `ping` requests | Handled by SDK's low-level `Server` automatically. |
| **Cancellation notification** | Client sends `notifications/cancelled` with `requestId` | Handled by SDK via `AbortSignal`. Correctly exposed as `signal` on `McpToolContext`. |

---

## Features Confirmed Working

| Feature | Implementation |
|---------|---------------|
| Tools (input schema, output schema, annotations, aliases, icons) | `@McpTool` decorator + registry |
| Resources (static + templates with completion, icons, annotations) | `@McpResource` decorator + `completeCallbacks` |
| Prompts (with argument completions and icons) | `@McpPrompt` decorator + `completeCallbacks` |
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
| Server description | `metadata.description` forwarded to SDK `ServerInfo` |
| Async module config | `registerAndServeHttpAsync` / `registerAndServeStdioAsync` |

---

## Architectural Observations

### Strengths

1. **Transport-agnostic registry** — Clean separation. Tools defined once, consumed via HTTP, stdio, or LLM adapter.
2. **NestJS-idiomatic pipeline** — Guards, interceptors, and DI compose naturally with the rest of a NestJS application.
3. **Dynamic wiring** — `onRegistrationChange` + `wireRegistryToServer` enables hot-registration after init.
4. **Enable/disable delegate** — Avoids leaking SDK-specific `RegisteredTool` types into the transport-agnostic registry.
5. **Session subscription cleanup** — Proper memory leak prevention on disconnect.
6. **LLM adapter** — Elegant "define once, consume everywhere" with per-provider aliases, name sanitization, and cached name maps.

### Design Concerns

1. **Single McpServer per session in HTTP mode** — Each session creates its own `McpServer` + `wireRegistryToServer`. With 100 concurrent sessions, that's 100 sets of registered tools/resources/prompts and 100 entries in the registry's change listener array. O(sessions x registrations).

2. **No auth extraction middleware** — `authInfo` comes from the SDK transport's `extra.authInfo`, but there's no hook to inject custom auth logic (validate JWT, hydrate user) without writing a guard. A dedicated auth middleware would reduce per-tool boilerplate.

3. **CORS config exported but not auto-applied** — `MCP_CORS_CONFIG` is exported as a constant, but consumers must manually apply it. Could be auto-configured by the HTTP module.

4. ~~**Express-only**~~ — Documented. JSDoc, README, and runtime guard now clearly communicate the Express requirement. Fastify users directed to `McpRegistryModule.registerOnly()`.

---

## LLM Adapter Gaps

| Issue | Detail | Status |
|-------|--------|--------|
| **No output schema forwarding** | Some LLM APIs (OpenAI `response_format`, Claude `tool_result_schema`) support structured output validation. Adapter only forwards `inputSchema`. | Open |
| **No streaming support** | `executeToolForProvider` returns a complete string. No incremental path for streaming tool results. | Open |
| **No tool-call-id handling** | LLM APIs (OpenAI, Claude) require correlating tool calls to responses via IDs. Adapter doesn't help with this. | Open |
| **No batch execution** | LLMs can request multiple tool calls in one turn. No `executeMultiple` method. | Open |
| ~~**Bedrock name sanitization too narrow**~~ | `replace(/-/g, '_')` handles hyphens but not dots, colons, or spaces. Bedrock requires `[a-zA-Z0-9_]+`. | **RESOLVED** — sanitization now uses `replace(/[^a-zA-Z0-9_]/g, '_')` for both Bedrock and Gemini configs. |
| ~~**Name map not cached**~~ | `buildNameMap()` is O(n) on every call. Should cache and invalidate on registration change. | **RESOLVED** — cached with automatic invalidation via `onRegistrationChange` subscription. |
| ~~**No batch execution**~~ | LLMs can request multiple tool calls in one turn. No `executeMultiple` method. | **RESOLVED** — `executeToolsForProvider(toolCalls, authInfo?)` added with `Promise.allSettled` for independent per-call error handling and `id` passthrough for provider correlation. |

---

## Recommended Actions

### ~~Critical (correctness)~~ ALL RESOLVED

1. ~~Fix `McpToolOptions` detection to include `'outputSchema'` in the check~~ **DONE**
2. ~~Pass `description` from `McpServerMetadata` to `McpServer()` constructor~~ **DONE**

### ~~High (spec compliance / production readiness)~~ ALL RESOLVED

3. ~~Add `icons` support to `McpToolMetadata`, `McpResourceMetadata`, `McpPromptMetadata`~~ **DONE**
4. ~~Add async module factory methods (`registerAndServeHttpAsync`, `registerAndServeStdioAsync`)~~ **DONE**
5. ~~Add prompt argument completion callback support to `@McpPrompt`~~ **DONE**

### Medium (improvements)

6. ~~Cache `buildNameMap()` in LLM adapter (invalidate on registry `onRegistrationChange`)~~ **DONE**
7. ~~Expand Bedrock name sanitization to strip all non-`[a-zA-Z0-9_]` characters~~ **DONE**
8. ~~Add resource `annotations` (audience, priority, lastModified) to `McpResourceMetadata`~~ **DONE**
9. ~~Document or enforce Express-only requirement for `McpHttpModule`~~ **DONE**
10. ~~Add batch `executeToolsForProvider` method to LLM adapter~~ **DONE**

### Low (nice to have / defer)

11. Resumability config passthrough (event store option)
12. Tasks support (wait for SDK to stabilize experimental API)
13. Auto-apply CORS in HTTP module
14. Add auth extraction middleware hook

---

## Verification Notes

- Pagination: Confirmed handled internally by SDK's `McpServer.registerTool/Resource/Prompt`
- Completions capability: SDK advertises automatically when resource templates or prompts have completion callbacks
- `ping`: Handled by SDK's low-level `Server` class
- Cancellation: SDK propagates via `AbortSignal` — correctly forwarded to `McpToolContext.signal`
- `logging/setLevel`: SDK handles internally; `sendLog` respects the client-set level
- All 144 `lib-server-mcp` tests and 30 `lib-server-mcp-llm-adapter` tests pass
