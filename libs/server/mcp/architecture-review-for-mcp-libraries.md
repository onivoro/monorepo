# MCP Library Audit: Spec Compliance, Integrity, and Gap Analysis

**Date**: 2026-04-21
**Libraries Analyzed**:

1. `@onivoro/server-mcp` v24.33.21 — MCP protocol server for NestJS
2. `@onivoro/server-mcp-llm-adapter` v24.33.21 — LLM provider tool format adapter
3. `@onivoro/server-mcp-auth` v24.33.21 — Resource server auth (JWT validation, JWKS, scope registry, PRM)
4. `@onivoro/server-mcp-oauth` v24.33.21 — Embedded OAuth 2.1 authorization server (**deprecated since 2026-10-11**; see below)

**MCP Spec Version**: 2025-11-25 (third major revision)
**SDK Version Installed**: `@modelcontextprotocol/sdk ^1.28.0` (latest stable: 1.29.0)

> **Update 2026-10-11.** This audit describes the libraries as of its date. They have since moved to v2 of the MCP TypeScript SDK (`@modelcontextprotocol/server` and friends) and serve spec revision 2026-07-28 alongside 2025-era clients; each package's README is current. The section below records why `@onivoro/server-mcp-oauth` was deprecated as part of that work.

---

## Deprecation of `@onivoro/server-mcp-oauth` (2026-10-11)

`@onivoro/server-mcp-oauth` embeds an OAuth 2.1 authorization server in the MCP server by wrapping the SDK's `mcpAuthRouter` and `OAuthServerProvider`. It is deprecated because the parts of the SDK and the spec it is built on appear to have no future.

### Reasons

1. **The SDK has frozen the code it wraps.** In v2 of the MCP TypeScript SDK, the authorization-server helpers (`mcpAuthRouter`, `OAuthServerProvider`, `ProxyOAuthServerProvider`, `OAuthRegisteredClientsStore`) exist only in `@modelcontextprotocol/server-legacy`. npm marks that package deprecated: "a frozen copy of v1's SSE transport and OAuth Authorization Server helpers for migration purposes only. Use StreamableHTTP from @modelcontextprotocol/server and a dedicated OAuth server in production. Will not receive new features." Its README says it "is planned for removal in v3". Nothing in the v2 server packages replaces it, so once `server-legacy` is removed there is nothing left for this package to wrap.
2. **The spec treats MCP servers as resource servers, not authorization servers.** Revision 2025-06-18 classified MCP servers as OAuth resource servers that point clients to a separate authorization server through protected resource metadata (RFC 9728) ([changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)). An embedded authorization server isn't forbidden, but the spec's model and the SDK's guidance both assume a dedicated one.
3. **The spec has deprecated the registration method the router implements.** Revision 2026-07-28 deprecates OAuth 2.0 Dynamic Client Registration (RFC 7591), which the SDK router serves at `/register`, in favour of Client ID Metadata Documents ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)). Under the spec's new feature lifecycle policy, deprecated features are scheduled for removal after a window of at least twelve months.

The package added Client ID Metadata Document support itself, addressing reason 3 for its own users, but it cannot address reason 1: it depends on SDK code that is frozen and scheduled for removal.

### Impact in this repository

No other package depends on it. Its only remaining consumers in the repository are:

- the workspace's `smoke:nest11` script and `tools/nest11-smoke`, which check its protected-resource route on Nest 11;
- the `tsconfig.base.json` path alias for the package itself.

`@onivoro/server-mcp-auth` does not depend on it; the dependency runs the other way only in an `mcp-oauth` integration spec that composes the two modules.

### What was done

- The README opens with a deprecation notice, the reasons above, and a migration path: run a dedicated authorization server (hosted, such as Amazon Cognito, Auth0, Entra ID or Okta, or self-operated, such as Keycloak or Ory Hydra) and validate its tokens with `McpAuthModule` from `@onivoro/server-mcp-auth`.
- `package.json`'s description starts with "DEPRECATED"; `McpOAuthModule`, `McpOAuthConfig`, the clients stores and the package entry point carry `@deprecated` JSDoc; the module logs a one-time deprecation warning at startup (outside `NODE_ENV=test`).
- The `server-mcp` README and the package guide mark it deprecated.
- The `@onivoro/create-mcp-server` scaffolder, whose `--oauth` option added this package to generated projects, has been deleted. It was never published: it sat outside both the `nx release` projects and the `publish.yml` package list, so `npx @onivoro/create-mcp-server` never worked.
- Still to do at release: `npm deprecate @onivoro/server-mcp-oauth "<message>"`. Removal can follow in a later major release, no later than the SDK's removal of `server-legacy`.

---

## Integrity Issues (Bugs / Correctness Problems)

### ~~1. `McpToolOptions` detection is fragile~~ RESOLVED

**File**: `mcp.decorator.ts:100`

The `in` check now includes all `McpToolOptions` keys: `aliases`, `annotations`, `title`, `outputSchema`, and `icons`. Options objects with any recognized key are correctly routed to the options branch.

---

### ~~2. `description` not passed to McpServer constructor~~ RESOLVED

**Files**: `mcp-http.service.ts`, `mcp-stdio.module.ts`

Both modules now forward `metadata.description` to the SDK's `McpServer` constructor via conditional spread.

---

### ~~3. `buildCapabilities` hardcodes `logging: {}` unconditionally~~ RESOLVED

**File**: `wire-registry-to-server.ts:11`

`buildCapabilities` now accepts an optional `options` parameter with a `logging` flag (defaults to `true`). Transport modules (HTTP, stdio) get logging advertised automatically. Registry-only consumers can pass `{ logging: false }` to avoid advertising a capability that no transport can deliver. JSDoc documents the intended usage.

---

### ~~4. Express-only HTTP transport~~ RESOLVED

**File**: `mcp-http.module.ts`

The controller now includes a runtime guard that returns a clear JSON-RPC error when `req.body` is undefined (Fastify platform, missing body parser). JSDoc on `McpHttpModule` documents the Express-only requirement and recommends `McpRegistryModule.registerOnly()` for Fastify users. README includes a "Platform requirement" section.

---

### ~~5. Resource subscription handlers have no logging for missing sessionId~~ RESOLVED

**File**: `wire-registry-to-server.ts:159-175`

Subscribe and unsubscribe handlers now log a warning via NestJS `Logger` when `sessionId` is missing. The handlers still return `{}` (per spec, subscribe should not fail), but missing session IDs are no longer silently swallowed — transport bugs are now visible in logs.

---

### ~~6. `McpLlmToolAdapter.buildNameMap()` rebuilds on every call~~ RESOLVED

**File**: `mcp-llm-tool-adapter.ts`

The name map is now cached and automatically invalidated when the registry fires a registration change event. The adapter implements `OnModuleInit` to subscribe to the registry's `onRegistrationChange` listener.

---

## Spec Gaps: MCP 2025-11-25

### HIGH PRIORITY

| Gap                                 | Spec Requirement                                                                                                             | Status                                                                                                                                                                                             |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**Prompt argument completions**~~ | `completion/complete` with `ref: { type: "ref/prompt" }` allows clients to get autocomplete suggestions for prompt arguments | **RESOLVED** — `McpPromptMetadata.completeCallbacks` added, wired to SDK's `registerPrompt` as `complete` config.                                                                                  |
| ~~**`icons` field**~~               | Tools, resources, and prompts can have `icons: Array<{ url, mediaType?, size? }>` for client UI rendering                    | **RESOLVED** — `McpIcon` interface added. `icons` supported on `McpToolMetadata`, `McpResourceMetadata`, `McpPromptMetadata`, and `McpToolOptions`. All wired through to SDK registration.         |
| ~~**Async module factories**~~      | Production configs often come from environment/secrets at runtime                                                            | **RESOLVED** — `registerAndServeHttpAsync()` and `registerAndServeStdioAsync()` added with `{ imports, inject, useFactory }` pattern. `McpModuleAsyncOptions` and `McpStdioAsyncOptions` exported. |

### MEDIUM PRIORITY

| Gap                                   | Spec Requirement                                                                                                         | Status                                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ~~**Resource `annotations`**~~        | Resources can have `audience`, `priority`, and `lastModified` annotations                                                | **RESOLVED** — `McpResourceAnnotations` interface added to `McpResourceMetadata`. Wired through to SDK resource config.                                                                                                        |
| **Tasks (experimental)**              | Long-running tools return `CreateTaskResult`. Status polling, cancellation, notifications via `ExperimentalServerTasks`. | Not implemented. Experimental in SDK — defer until stable.                                                                                                                                                                     |
| ~~**Resumability config**~~           | SSE streams can have event IDs. Client reconnects with `Last-Event-ID` for replay. SDK supports with event store config. | **RESOLVED** — `McpModuleConfig` now accepts `session.eventStore`, `session.idGenerator`, and `enableJsonResponse`. Forwarded to `StreamableHTTPServerTransport`. `EventStore`, `StreamId`, `EventId` re-exported from barrel. |
| **Sampling with tools**               | `sampling/createMessage` can include a `tools` array and `toolChoice` for multi-turn agentic loops                       | `createMessage` is a raw passthrough (`Record<string, unknown>`), which works but provides no typed helper.                                                                                                                    |
| **`MCP-Protocol-Version` validation** | After init, clients include `MCP-Protocol-Version` header. Server should validate.                                       | Header is in CORS allowed list but not validated by `McpHttpService`. SDK transport likely handles this internally.                                                                                                            |

### LOW PRIORITY

| Gap                                    | Spec Requirement                                        | Status                                                                               |
| -------------------------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **URL-mode elicitation notifications** | `notifications/elicitation/complete` for URL-mode flows | Passthrough via `elicitInput` callback; SDK handles internally.                      |
| **Error code `-32002`**                | `ResourceNotFound` for unknown resource URIs            | Delegated to SDK.                                                                    |
| **`ping`**                             | Server responds to `ping` requests                      | Handled by SDK's low-level `Server` automatically.                                   |
| **Cancellation notification**          | Client sends `notifications/cancelled` with `requestId` | Handled by SDK via `AbortSignal`. Correctly exposed as `signal` on `McpToolContext`. |

---

## Features Confirmed Working

| Feature                                                            | Implementation                                                                                                                    |
| ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Tools (input schema, output schema, annotations, aliases, icons)   | `@McpTool` decorator + registry                                                                                                   |
| Resources (static + templates with completion, icons, annotations) | `@McpResource` decorator + `completeCallbacks`                                                                                    |
| Prompts (with argument completions and icons)                      | `@McpPrompt` decorator + `completeCallbacks`                                                                                      |
| Progress reporting                                                 | `sendProgress` on `McpToolContext`                                                                                                |
| Logging                                                            | `sendLog` on `McpToolContext`                                                                                                     |
| Sampling                                                           | `createMessage` on `McpToolContext`                                                                                               |
| Elicitation                                                        | `elicitInput` on `McpToolContext`                                                                                                 |
| Roots listing                                                      | `listRoots` on `McpToolContext`                                                                                                   |
| Resource subscriptions                                             | `subscribeResource` / `notifyResourceUpdated`                                                                                     |
| Tool enable/disable                                                | `setToolEnabled` + delegate pattern                                                                                               |
| OAuth 2.1 auth flow                                                | `McpAuthInfo` with scopes, resource indicator                                                                                     |
| Cancellation                                                       | `AbortSignal` forwarding                                                                                                          |
| DNS rebinding protection                                           | `allowedOrigins` config                                                                                                           |
| Dynamic registration                                               | `onRegistrationChange` + `listChanged` capability                                                                                 |
| Pagination                                                         | Delegated to SDK (handles internally)                                                                                             |
| Guards (authorization)                                             | `@McpGuard` decorator, `McpScopeGuard` built-in                                                                                   |
| Interceptors                                                       | Onion-model `McpToolInterceptor` chain                                                                                            |
| Multiple content types                                             | `McpContentBlock` union (text, image, audio, resource, resource_link)                                                             |
| Structured output                                                  | `outputSchema` + `structuredContent` in results                                                                                   |
| Server instructions                                                | `metadata.instructions` merged into `ServerOptions`                                                                               |
| Server description                                                 | `metadata.description` forwarded to SDK `ServerInfo`                                                                              |
| Async module config                                                | `registerAndServeHttpAsync` / `registerAndServeStdioAsync`                                                                        |
| Auth strategy                                                      | `McpAuthStrategy` interface — DI-resolved `@Injectable()` service, runs before guards for centralized token validation/enrichment |
| JWT validation (auth library)                                      | `McpJwtAuthStrategy` — JWKS-backed JWT verification, issuer/audience/expiry checks, configurable claims extraction                |
| JWKS fetching + caching (auth library)                             | `McpJwksService` — wraps `jwks-rsa` with configurable cache TTL and rate limiting                                                 |
| Scope auto-discovery (auth library)                                | `McpScopeRegistry` — scans `@McpGuard(McpScopeGuard, { scopes })` metadata, subscribes to dynamic registration changes            |
| Protected Resource Metadata (auth library)                         | `McpProtectedResourceController` — serves `/.well-known/oauth-protected-resource` per RFC 9728                                    |
| Auth enrichment (auth library)                                     | Extracts `clientId`, `scopes`, `expiresAt`, `extra` claims into `McpAuthInfo` from JWT payload                                    |
| Provider-agnostic JWT config (auth library)                        | Configurable `clientIdClaim`, `scopeClaim`, `scopeFormat`, `extraClaims` — supports Cognito, Auth0, Entra ID out of the box       |
| SDK token verifier bridge (auth library)                           | `McpJwtAuthStrategy` implements both `McpAuthStrategy` and SDK's `OAuthTokenVerifier`                                             |
| Auth testing utilities (auth library)                              | `McpTestAuthStrategy`, `createMockAuthInfo()`, `createMockJwt()` for integration and unit tests                                   |
| Embedded OAuth 2.1 server (oauth library, **deprecated**)          | `McpOAuthModule` — mounts SDK's `mcpAuthRouter` as Express middleware via NestJS `MiddlewareConsumer`                             |
| OAuth endpoints (oauth library, **deprecated**)                    | `/.well-known/oauth-authorization-server`, `/authorize`, `/token`, `/register`, `/revoke`                                         |
| OAuth strategy DI (oauth library, **deprecated**)                  | Accepts `OAuthServerProvider` as class reference (DI-resolved) or instance (e.g. `ProxyOAuthServerProvider`)                      |
| Memory clients store (oauth library, **deprecated**)               | `McpMemoryClientsStore` — in-memory `OAuthRegisteredClientsStore` with `seedClient()` for dev/testing                             |
| Async module config (auth + oauth)                                 | Both libraries support `registerAsync()` with `{ imports, inject, useFactory }` pattern (the oauth library is deprecated)         |

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

2. ~~**No auth extraction middleware**~~ — **RESOLVED** — `McpAuthStrategy` interface added to `McpToolRegistry`. Implemented as an `@Injectable()` NestJS service with full DI access (can inject `JwtService`, repositories, etc.). Runs before guards in `executeToolRaw()` to validate tokens, decode JWTs, hydrate user context, or reject unauthenticated requests centrally. Configured via `authStrategy` class reference on both `McpModuleConfig` and `McpStdioConfig`. Modules auto-include the class in providers and resolve it through `ModuleRef` — follows the same DI pattern as guards.

3. **CORS config exported but not auto-applied** — `MCP_CORS_CONFIG` is exported as a constant, but consumers must manually apply it. Could be auto-configured by the HTTP module.

4. ~~**Express-only**~~ — Documented. JSDoc, README, and runtime guard now clearly communicate the Express requirement. Fastify users directed to `McpRegistryModule.registerOnly()`.

---

## LLM Adapter Gaps

| Issue                                        | Detail                                                                                                  | Status                                                                                                                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ~~**No output schema forwarding**~~          | Some LLM APIs support structured output validation. Adapter only forwarded `inputSchema`.               | **RESOLVED** — `formatToolWithOutput` optional callback added to `LlmAdapterConfig`. `getOutputSchemas()` method exposes converted output JSON Schemas. Built-in configs unchanged (no current provider API supports per-tool output schema).   |
| **No streaming support**                     | `executeToolForProvider` returns a complete string. No incremental path for streaming tool results.     | **Deferred** — requires core registry streaming primitive. `executeToolRaw` returns `Promise<unknown>`, interceptor chain is synchronous. MCP tool results are single-shot JSON-RPC responses. Progress reporting available via `sendProgress`. |
| ~~**No tool-call-id handling**~~             | LLM APIs (OpenAI, Claude) require correlating tool calls to responses via IDs.                          | **RESOLVED** — `executeToolsForProvider` (batch) passes through `id`. New `executeToolCallForProvider` provides the same for single calls with `ProviderToolCallResult` return type.                                                            |
| ~~**No batch execution**~~                   | LLMs can request multiple tool calls in one turn. No `executeMultiple` method.                          | **RESOLVED** — `executeToolsForProvider(toolCalls, authInfo?)` added with `Promise.allSettled` for independent per-call error handling and `id` passthrough for provider correlation.                                                           |
| ~~**Bedrock name sanitization too narrow**~~ | `replace(/-/g, '_')` handles hyphens but not dots, colons, or spaces. Bedrock requires `[a-zA-Z0-9_]+`. | **RESOLVED** — sanitization now uses `replace(/[^a-zA-Z0-9_]/g, '_')` for both Bedrock and Gemini configs.                                                                                                                                      |
| ~~**Name map not cached**~~                  | `buildNameMap()` is O(n) on every call. Should cache and invalidate on registration change.             | **RESOLVED** — cached with automatic invalidation via `onRegistrationChange` subscription.                                                                                                                                                      |

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

11. ~~Resumability config passthrough (event store option)~~ **DONE**
12. Tasks support (wait for SDK to stabilize experimental API)
13. Auto-apply CORS in HTTP module
14. ~~Add auth extraction middleware hook~~ **DONE**

---

## Verification Notes

- Pagination: Confirmed handled internally by SDK's `McpServer.registerTool/Resource/Prompt`
- Completions capability: SDK advertises automatically when resource templates or prompts have completion callbacks
- `ping`: Handled by SDK's low-level `Server` class
- Cancellation: SDK propagates via `AbortSignal` — correctly forwarded to `McpToolContext.signal`
- `logging/setLevel`: SDK handles internally; `sendLog` respects the client-set level
- All 163 `lib-server-mcp` tests pass
- All 38 `lib-server-mcp-llm-adapter` tests pass
- All 52 `lib-server-mcp-auth` tests pass (JWT validation, JWKS service, scope registry, PRM controller, module integration, test utilities)
- All 12 `lib-server-mcp-oauth` tests pass (module register/registerAsync, config forwarding, memory clients store, McpMemoryClientsStore exports). The library is deprecated as of 2026-10-11; see above.
