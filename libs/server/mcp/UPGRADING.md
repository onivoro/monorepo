# Upgrading the `@onivoro/server-mcp*` packages to MCP SDK v2

This release moves the MCP packages from `@modelcontextprotocol/sdk` 1.x to v2 of the MCP TypeScript SDK, adds MCP spec revision 2026-07-28 alongside 2025-era clients, and fixes a set of correctness and security problems. It is a major release.

Code written against the libraries' own API — the `@McpTool`, `@McpResource` and `@McpPrompt` decorators, the modules, guards, interceptors, the registry, the LLM adapter — mostly keeps working. Expect to touch dependencies, any direct SDK imports, and configuration that relied on old defaults. The sections below list everything, in the order you're likely to meet it.

## What stays the same

- **Tool handlers** still receive `(params, context: McpToolContext)`, with the same fields (`authInfo`, `sessionId`, `signal`, `sendProgress`, `sendLog`) and a few new ones (`era`, `inputResponses`, `requestState`).
- **Resource and prompt handlers** receive a context the library owns, `McpHandlerContext`, instead of the SDK's own. Its common fields keep the names v1's `extra` used: `authInfo`, `sessionId`, `signal`. Only handlers that read other v1 `extra` fields (`requestId`, `_meta`, `sendNotification`, `sendRequest`, `requestInfo`) need changes.
- **Module wiring** — `registerAndServeHttp`, `registerAndServeStdio`, `registerOnly` and their async forms — accepts the same options as before, plus new optional ones (`allowedHosts`, `session.principal`, `requireBearerAuth.expectedResource`, `redirectLogsToStderr`). Some defaults changed; see [Behavior changes](#behavior-changes).
- **The two protocol eras** are handled inside `McpHttpModule` and `McpStdioModule`: 2026-07-28 requests go to the SDK's stateless handler, older clients to the session transport, and change notifications reach 2026-07-28 clients over `subscriptions/listen`.
- **The JWT and Cognito strategies** in `@onivoro/server-mcp-auth` already throw the v2 SDK's `OAuthError`.

## Required changes

1. **Dependencies.** Replace `@modelcontextprotocol/sdk` with `@modelcontextprotocol/server` (^2.3.1) and `@modelcontextprotocol/node` (^2.1.1). The v2 SDK needs zod ^4.2.0 and Node 20 or later.
2. **Direct SDK imports.** `McpServer`, `AuthInfo`, `OAuthTokenVerifier`, `OAuthError`, `OAuthErrorCode` and `EventStore` now come from `@modelcontextprotocol/server`. All six are also re-exported by `@onivoro/server-mcp`, so you can import them from the library instead. That only fixes where you import from, not what the types look like: they are still the SDK's. This mostly affects code that calls `wireRegistryToServer` or builds its own transport, and custom auth strategies.
3. **Custom token verifiers throw `OAuthError`.** A verifier rejects a token with `new OAuthError(OAuthErrorCode.InvalidToken, message)`. v1-style errors (`InvalidTokenError` and friends, which `@modelcontextprotocol/server-legacy/auth` still exports, so a port that only renames imports keeps compiling) are translated to the matching challenge, with a one-time warning; switch to `OAuthError`, since the translation is a stopgap. The verified token must have an expiry (`expiresAt`), or it is rejected with 401.
4. **`McpIcon` fields** are `src`, `mimeType`, `sizes` (an array) and `theme`, as in the spec. The old `url`, `mediaType` and `size` never matched the spec, so clients ignored them.
5. **`McpAuthModule.configureJwt()` requires `audience` or `resourceIdentifier`**, so that only tokens issued for your server are accepted (the spec requires this). `allowAnyAudience: true` opts out, with a warning. `configureCognito()` is unaffected.

## Behavior changes

- **HTTP responses are SSE streams by default** (`enableJsonResponse` defaults to `false`), so progress and log messages reach the client. Set `enableJsonResponse: true` for one JSON body per request; you then lose progress and log messages for every client, and `inputRequired` for 2025-era clients.
- **Cross-origin browser requests are rejected** unless the origin is in `allowedOrigins` (`'*'` allows any). A server on a loopback address only answers to `localhost`, `127.0.0.1` and `[::1]` host names, unless you set `allowedHosts` or the request carries a forwarding header (`X-Forwarded-For`, `X-Forwarded-Host` or `Forwarded`). That exemption is a DNS-rebinding hole, since a rebound page can add those headers itself; see [Forwarding headers and `allowedHosts` ports](#forwarding-headers-and-allowedhosts-ports). Non-browser clients are unaffected.
- **Forwarding headers on loopback: a warning now, a new default next major.** By default a loopback server still lets in a request that carries a forwarding header, and logs a warning the first time it does. In the next major release `trustForwardedHosts` defaults to `false`, and the loopback check reads `Host` strictly. To prepare, set `trustForwardedHosts: false` when no proxy is in front, or set `allowedHosts` to the names a local proxy sends; or set `trustForwardedHosts: true` to keep today's behavior deliberately.
- **Error messages: a warning now, a new default next major.** Clients still see the message of any error a tool throws, and `McpHttpModule`/`McpStdioModule` log a warning at startup unless you set `exposeErrorMessages`. In the next major release the default becomes `false`: a tool error the client sees is then `Error executing <tool>: Internal error`, unless the error is an `McpToolError` (or a guard denial or argument validation failure). To prepare, throw `McpToolError` for messages meant for the client and set `exposeErrorMessages: false`; or set `true` to keep today's behavior deliberately.
- **Arguments are validated after the auth strategy and guards**, over every transport. A denied caller gets the denial, not a schema error, and transforms run once.
- **Tools guarded by `McpScopeGuard` get a 403 `insufficient_scope` challenge** over HTTP with `requireBearerAuth` when the token lacks the scopes, instead of a tool error, so clients can ask the user for them.
- **Stateful sessions belong to their creator.** A request presenting another principal's `Mcp-Session-Id` gets 404. The default principal is the token's `clientId` plus `extra.sub`; `@onivoro/server-mcp-auth` now always puts the JWT subject in `extra.sub`.
- **Stateless HTTP answers `GET` and `DELETE` with 405.**
- **stdio servers send Nest's logs to stderr**, since stdout carries the protocol.
- **`@onivoro/server-mcp-audit`** records errors, guard denials and rejected calls (with an `outcome`), skips `inputRequired` rounds, and no longer passes the bearer token to the sink. Sinks that read `event.context.authInfo.token` must stop.
- **`@onivoro/server-mcp-llm-adapter`** reports tool results marked `isError: true` and `inputRequired(...)` results as failures.

## Forwarding headers and `allowedHosts` ports

These changes came after the SDK v2 release, in a minor release.

- **`allowedHosts` entries without a port match any port.** Before, `allowedHosts: ['localhost']` matched only a `Host` of exactly `localhost` (port 80); it now matches `localhost:3000` and every other port too. Entries with a port behave as before, and every `Host` accepted before is still accepted. This doesn't weaken rebinding protection: a rebound page's requests name the attacker's host name, which still matches no entry. To keep a single port, write it in the entry (`'localhost:3000'`).
- **New option `trustForwardedHosts`.** Unset, it behaves as before, apart from a one-time warning when a forwarding header is what let a request in. `false` closes the hole: a loopback request must name a loopback host whatever headers it carries, `Host` is read strictly, and the same-origin `Origin` check ignores `X-Forwarded-Host`. See "DNS rebinding protection" in the `@onivoro/server-mcp` README.

## Spec 2026-07-28 and server-to-client requests

Spec 2026-07-28 has no server-to-client requests. `context.createMessage`, `context.elicitInput` and `context.listRoots` still work for 2025-era clients, but 2026-07-28 clients never get them. A tool that needs input from every client should return `inputRequired(...)` and read the answers from `context.inputResponses` on the retry; for 2025-era clients the SDK turns that into real elicitation (or sampling, or roots) requests. Nothing in the library can hide this difference, but the old callbacks keep working, so you can move tools over one at a time. See "Asking the user for input" in the `@onivoro/server-mcp` README.

## Deprecated and removed

- **`@onivoro/server-mcp-oauth` is deprecated.** It depends on the SDK's frozen `@modelcontextprotocol/server-legacy`, which is planned for removal in the SDK's v3. Move to a dedicated authorization server with `@onivoro/server-mcp-auth`; the package's README has the reasons and the steps. It still works and now supports Client ID Metadata Documents.

## Releasing

All the libraries in this repository release together at one shared version, so this major release bumps every `@onivoro/*` package, not only the MCP ones.
