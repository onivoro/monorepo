# @onivoro/server-mcp-oauth

> **Deprecated.** This package receives fixes only and will be removed in a future major release. Run a dedicated authorization server instead, and validate its tokens with [`@onivoro/server-mcp-auth`](https://www.npmjs.com/package/@onivoro/server-mcp-auth). See [Why this package is deprecated](#why-this-package-is-deprecated).

Embedded OAuth 2.1 authorization server for MCP. Wraps the MCP SDK's `OAuthServerProvider` infrastructure into NestJS modules.

## Why this package is deprecated

An MCP server that is also its own authorization server is the setup this package exists for, and the pieces it is built on appear to have no future:

- **The SDK has frozen them.** The authorization-server helpers this package wraps (`mcpAuthRouter`, `OAuthServerProvider`, `ProxyOAuthServerProvider`, the clients store) exist in v2 of the MCP TypeScript SDK only in `@modelcontextprotocol/server-legacy`. That package is published as deprecated: "a frozen copy of v1's SSE transport and OAuth Authorization Server helpers for migration purposes only. Use StreamableHTTP from @modelcontextprotocol/server and a dedicated OAuth server in production. Will not receive new features." Its README says it "is planned for removal in v3", and nothing in v2 replaces it.
- **The spec has moved away from them.** Since revision 2025-06-18 the spec classifies MCP servers as OAuth resource servers, which point clients to a separate authorization server through protected resource metadata ([changelog](https://modelcontextprotocol.io/specification/2025-06-18/changelog)). Revision 2026-07-28 deprecates Dynamic Client Registration (`/register`), the client registration method the SDK's router implements, in favour of Client ID Metadata Documents; under the spec's new feature lifecycle policy, deprecated features are scheduled for removal after at least twelve months ([changelog](https://modelcontextprotocol.io/specification/2026-07-28/changelog)).

This package already works around the second point (it adds Client ID Metadata Documents itself; see below), but it can't work around the first: once the SDK drops `server-legacy`, there is nothing left to wrap.

### Migrating

1. Run a dedicated OAuth 2.1 authorization server: a hosted one (Amazon Cognito, Auth0, Microsoft Entra ID, Okta, …) or one you operate (Keycloak, Ory Hydra, …). Prefer one that supports Client ID Metadata Documents, since spec 2026-07-28 expects clients to use them.
2. Replace `McpOAuthModule` with `McpAuthModule` from `@onivoro/server-mcp-auth` (`configureJwt()` or `configureCognito()`), pointing `issuer`/`authorizationServers` at that server and setting `audience` to the value it puts in `aud` for your MCP server.
3. Keep `McpHttpModule.registerAndServeHttp({ authStrategy: McpJwtAuthStrategy, requireBearerAuth: true })`. MCP clients find the new authorization server through the protected resource metadata `McpAuthModule` serves.

The package keeps working until it is removed.

## How it is built

The SDK's authorization-server pieces live in `@modelcontextprotocol/server-legacy/auth` (see above). They work and get no new features, which is why Client ID Metadata Documents are implemented here (see below).

## Start here

Use this package only when your system needs to act as the OAuth authorization server, and only until you can move to a dedicated one (see the deprecation notice above).

If you just need to validate JWTs from Cognito, Auth0, Entra, or another external provider, use `@onivoro/server-mcp-auth` instead.

If you are deciding how the packages fit together, start with:
[MCP Server Package Guide](https://github.com/onivoro/monorepo/blob/main/libs/server/mcp-package-guide.md)

## Installation

```bash
npm install @onivoro/server-mcp-oauth
```

**Peer dependencies:** `@modelcontextprotocol/server-legacy`, `@nestjs/common`, `@nestjs/core`, and optionally `express` (types only; the SDK router runs on the Express that Nest's default platform provides)

`@onivoro/server-mcp` is a regular dependency and is installed automatically.

## Quick start

`McpOAuthModule` mounts authorization-server endpoints. It does **not** protect your MCP route by itself.

```typescript
import { Module } from '@nestjs/common';
import { McpOAuthModule } from '@onivoro/server-mcp-oauth';
import { MyOAuthProvider } from './my-oauth-provider';

@Module({
  imports: [
    McpOAuthModule.configure({
      provider: MyOAuthProvider,
      issuerUrl: 'https://auth.example.com',
      scopesSupported: ['read', 'write', 'admin'],
    }),
  ],
})
export class AppModule {}
```

`configure()` is the primary API. `register()` and `registerAsync()` remain available as backwards-compatible aliases.

## What it does

`McpOAuthModule` wraps the MCP SDK's `mcpAuthRouter` and exposes standard OAuth 2.1 endpoints through NestJS controllers:

| Endpoint                                               | Method       | Description                                                                                                                                                                                                                                         |
| ------------------------------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/.well-known/oauth-authorization-server`              | GET, OPTIONS | Authorization server metadata (RFC 8414)                                                                                                                                                                                                            |
| `/.well-known/oauth-protected-resource<resource path>` | GET, OPTIONS | Protected resource metadata (RFC 9728), served at the path of `resourceServerUrl` (e.g. `/.well-known/oauth-protected-resource/mcp`). The bare path answers only when that URL has no path. Not served with `serveProtectedResourceMetadata: false` |
| `/authorize`                                           | GET, POST    | Authorization endpoint                                                                                                                                                                                                                              |
| `/token`                                               | POST         | Token endpoint                                                                                                                                                                                                                                      |
| `/register`                                            | POST         | Dynamic client registration (RFC 7591), only when `provider.clientsStore.registerClient` exists                                                                                                                                                     |
| `/revoke`                                              | POST         | Token revocation (RFC 7009), only when `provider.revokeToken` exists                                                                                                                                                                                |

Behavior inherited from the SDK router:

- `issuerUrl` must be HTTPS unless the host is `localhost` or `127.0.0.1` (or `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL` is `true` or `1`), and must have no query or fragment.
- Endpoints are rate-limited by default; tune or disable that with `authorizationOptions`, `tokenOptions`, `clientRegistrationOptions`, and `revocationOptions`.
- The PRM document lists `issuerUrl` as the only authorization server.
- A request on one of these routes that the router does not handle gets a `404`.
- Redirects back to the client from `/authorize` carry the RFC 9207 `iss` parameter, which spec 2026-07-28 has clients check, and the metadata says so (`authorization_response_iss_parameter_supported`). A provider's `authorizationResponseIssParameterSupported: false` only changes that metadata field; `ProxyOAuthServerProvider` sets it, since the upstream server makes the redirect.

## What it does not do

`McpOAuthModule` does not:

- challenge unauthenticated requests on your MCP HTTP route
- validate bearer tokens for your MCP transport
- wire `authStrategy` into `McpHttpModule`

To protect an MCP HTTP route, combine it with either:

- `@onivoro/server-mcp-auth` and `McpJwtAuthStrategy`
- or your own `authStrategy` that implements the MCP SDK `OAuthTokenVerifier` interface

## When to use it

- You need embedded authorization-server endpoints for MCP clients.
- You want to own client registration and token issuance.
- You do not want to depend on an external OAuth provider for the auth-server role.

## When not to use it

- You only need to validate incoming JWTs.
- You expect this package alone to protect the MCP route.
- You are not prepared to manage client and token lifecycle concerns.

## Standalone vs bolted-on apps

The SDK router must sit at the application root. It advertises and matches its endpoints at fixed root paths: `/authorize`, `/token`, `/register`, `/revoke`, and `/.well-known/oauth-authorization-server`. Only the origin of `baseUrl` (or `issuerUrl`) is used to build the advertised endpoint URLs; a path on `baseUrl` is dropped, so `baseUrl: 'https://auth.example.com/api'` still advertises `https://auth.example.com/authorize`.

The controllers forward the full request path (`req.originalUrl`) to the router. In an existing app with `app.setGlobalPrefix('api')`, Nest would mount the routes at `/api/authorize` and so on, the router would not match them, and they would answer `404`. Exclude these routes when you set the global prefix so they stay at the root.

Set URL fields to the public URLs clients actually use:

| Field               | Standalone example             | Existing app with `app.setGlobalPrefix('api')` (OAuth routes excluded) |
| ------------------- | ------------------------------ | ---------------------------------------------------------------------- |
| `issuerUrl`         | `https://auth.example.com`     | `https://auth.example.com`                                             |
| `baseUrl`           | omit (defaults to `issuerUrl`) | omit                                                                   |
| `resourceServerUrl` | `https://api.example.com/mcp`  | `https://api.example.com/api/mcp`                                      |

`resourceServerUrl` is the protected MCP resource URL, not the OAuth server URL, and it decides the PRM path this module serves. If your MCP app uses `route: 'internal/mcp'` behind a global `api` prefix, use `https://api.example.com/api/internal/mcp`.

## Provider options

### Class reference (DI-resolved)

`configure()` registers the provider class inside `McpOAuthModule` itself, so you do not list it in your own `providers`. Because it is instantiated in that module, it can inject `McpMemoryClientsStore`, `MCP_OAUTH_CONFIG`, and providers from global modules. If it needs services from your own modules, use `configureAsync()` (below) instead.

```typescript
import { Injectable } from '@nestjs/common';
import type { OAuthServerProvider } from '@modelcontextprotocol/server-legacy/auth';
import { McpMemoryClientsStore } from '@onivoro/server-mcp-oauth';

@Injectable()
class MyOAuthProvider implements OAuthServerProvider {
  constructor(private readonly store: McpMemoryClientsStore) {}

  get clientsStore() { return this.store; }
  async authorize(client, params, res) { ... }
  async challengeForAuthorizationCode(client, code) { ... }
  async exchangeAuthorizationCode(client, code, verifier, redirectUri, resource) { ... }
  async exchangeRefreshToken(client, refreshToken, scopes, resource) { ... }
  async verifyAccessToken(token) { ... }
}

McpOAuthModule.configure({
  provider: MyOAuthProvider,
  issuerUrl: 'https://auth.example.com',
})
```

### Instance (e.g. ProxyOAuthServerProvider)

For proxying to an upstream OAuth server, pass an instance directly:

```typescript
import { ProxyOAuthServerProvider } from '@modelcontextprotocol/server-legacy/auth';

McpOAuthModule.configure({
  provider: new ProxyOAuthServerProvider({
    endpoints: {
      authorizationUrl: 'https://upstream.example.com/authorize',
      tokenUrl: 'https://upstream.example.com/token',
    },
    verifyAccessToken: async (token) => { ... },
    getClient: async (clientId) => { ... },
  }),
  issuerUrl: 'https://auth.example.com',
})
```

### Async configuration with DI-resolved classes

`configureAsync()` also supports class-based providers. It does not register the class; it looks it up with `ModuleRef.get(..., { strict: false })`, so the class must be provided by a module in the container. This is the way to give the provider dependencies from your own modules:

```typescript
@Module({
  providers: [MyOAuthProvider],
  exports: [MyOAuthProvider],
})
class OAuthProviderModule {}

McpOAuthModule.configureAsync({
  imports: [ConfigModule, OAuthProviderModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    provider: MyOAuthProvider,
    issuerUrl: config.getOrThrow('OAUTH_ISSUER_URL'),
    resourceServerUrl: config.getOrThrow('RESOURCE_SERVER_URL'),
  }),
});
```

## Configuration

### `McpOAuthConfig`

| Field                            | Type                           | Default                     | Description                                                                                                             |
| -------------------------------- | ------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `provider`                       | `OAuthServerProvider \| class` | _required_                  | Auth server implementation (instance or class)                                                                          |
| `issuerUrl`                      | `string`                       | _required_                  | Authorization server issuer URL                                                                                         |
| `baseUrl`                        | `string?`                      | `issuerUrl`                 | Origin for the advertised endpoint URLs (its path is ignored by the SDK)                                                |
| `scopesSupported`                | `string[]?`                    | —                           | Scopes this server supports                                                                                             |
| `resourceName`                   | `string?`                      | —                           | Human-readable resource name in PRM                                                                                     |
| `resourceServerUrl`              | `string?`                      | `baseUrl`, then `issuerUrl` | Public MCP endpoint URL protected by this authorization server. Sets the PRM `resource` field and route                 |
| `serviceDocumentationUrl`        | `string?`                      | —                           | Service docs URL (AS metadata `service_documentation`, PRM `resource_documentation`)                                    |
| `authorizationOptions`           | `object?`                      | —                           | SDK authorization handler options                                                                                       |
| `tokenOptions`                   | `object?`                      | —                           | SDK token handler options                                                                                               |
| `clientRegistrationOptions`      | `object?`                      | —                           | SDK registration handler options                                                                                        |
| `revocationOptions`              | `object?`                      | —                           | SDK revocation handler options                                                                                          |
| `serveProtectedResourceMetadata` | `boolean?`                     | `true`                      | Serve `/.well-known/oauth-protected-resource`. Set `false` when `McpAuthModule` serves it                               |
| `clientIdMetadataDocuments`      | `boolean \| object?`           | `true`                      | Accept clients identified by a metadata document URL. See [Client ID Metadata Documents](#client-id-metadata-documents) |

`issuerUrl`, `baseUrl`, `resourceServerUrl`, and `serviceDocumentationUrl` must be absolute URLs. With `configure()` an invalid value throws when the module is built; with `configureAsync()` it throws when the config factory resolves.

### Async configuration

```typescript
McpOAuthModule.configureAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    provider: new ProxyOAuthServerProvider({ ... }),
    issuerUrl: config.get('OAUTH_ISSUER_URL'),
    scopesSupported: config.get('OAUTH_SCOPES').split(','),
  }),
  serveProtectedResourceMetadata: true, // Optional. Here, not in the factory: routes are fixed before it runs.
})
```

## Client ID Metadata Documents

MCP spec revision 2025-11-25 recommends that clients identify themselves with a Client ID Metadata Document instead of registering: the `client_id` is an `https` URL, and the JSON document at that URL describes the client (`client_name`, `redirect_uris`, and so on). The authorization server fetches the document when the client first appears, so there's nothing to register or store.

This module supports them by default and says so in its metadata (`client_id_metadata_document_supported: true`). When a `client_id` is an `https` URL with a path (and no fragment, credentials, or `.`/`..` segments), the module fetches the document instead of asking your provider's `clientsStore`. Any other `client_id` goes to your `clientsStore` as before, and `/register` keeps working if your store supports it.

A document is accepted only if:

- the URL answers `200` within `timeoutMs` (default 5 s), without a redirect, with at most `maxBytes` (default 5 KiB) of JSON;
- its `client_id` is exactly the URL it was fetched from;
- it lists at least one valid `redirect_uris` entry;
- it contains no `client_secret`, and its `token_endpoint_auth_method`, if present, is `none`. These are public clients: they hold no secret and rely on PKCE, which the SDK router always requires.

Authorization requests are then checked against the document's `redirect_uris` like any other client's.

Documents are cached for their `Cache-Control: max-age` (capped at a day; `no-store` and `no-cache` mean no caching), or `cacheTtlMs` (default 5 minutes) when they don't say. A document that fails is remembered as invalid for a minute.

Fetching URLs a client chooses could let it probe the server's own network, so by default the module refuses documents on loopback, private, link-local and other non-public addresses. The check applies to the address actually connected to, so a host name can't be re-pointed between check and request. `allowPrivateNetwork: true` lifts it, for development only.

```typescript
McpOAuthModule.configure({
  provider: MyOAuthProvider,
  issuerUrl: 'https://auth.example.com',
  clientIdMetadataDocuments: { cacheTtlMs: 60_000, timeoutMs: 3_000 }, // or false to turn off
});
```

The pieces are exported for custom setups: `McpClientIdMetadataDocumentStore` (wraps any clients store), `isClientIdMetadataDocumentUrl`, `parseClientIdMetadataDocument`, `fetchClientIdMetadataDocument` and `isPrivateNetworkAddress`.

## McpMemoryClientsStore

An in-memory `OAuthRegisteredClientsStore` for development and testing. Provided by default.

```typescript
const store = module.get(McpMemoryClientsStore);

// Seed a test client
store.seedClient('test-client-id', {
  client_name: 'Test Client',
  redirect_uris: ['http://localhost:3000/callback'],
});

store.size; // number of stored clients
store.clear(); // clear between tests
```

`registerClient()` assigns a random UUID `client_id` and `client_id_issued_at`. `McpOAuthModule` only provides the store; your provider decides whether to use it by returning it from `clientsStore`.

For production, implement `OAuthRegisteredClientsStore` with a persistent backend (database, Redis, etc.).

Outside `NODE_ENV=test`, the package logs a warning when the configured provider's `clientsStore` is the module's `McpMemoryClientsStore`, and again the first time the store registers a client, because registered clients are lost on process restart.

## Using with [@onivoro/server-mcp-auth](https://www.npmjs.com/package/@onivoro/server-mcp-auth)

For a full embedded OAuth + protected MCP server, combine all three libraries:

```typescript
@Module({
  imports: [
    McpOAuthModule.configure({
      provider: MyOAuthProvider,
      issuerUrl: 'https://auth.example.com',
      scopesSupported: ['read', 'write'],
      serveProtectedResourceMetadata: false, // McpAuthModule serves it
    }),
    McpAuthModule.configureJwt({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      issuer: 'https://auth.example.com',
      audience: 'https://api.example.com/mcp',
      resourceServerUrl: 'https://api.example.com/mcp',
    }),
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '1.0.0' },
      authStrategy: McpJwtAuthStrategy,
      requireBearerAuth: true,
    }),
  ],
})
export class AppModule {}
```

That composition gives you:

- OAuth authorization-server endpoints from `McpOAuthModule`
- JWT verification and Protected Resource Metadata from `McpAuthModule`
- HTTP `401` bearer challenges on the configured MCP route from `McpHttpModule`

Notes:

- `McpAuthModule` verifies tokens against `jwksUri`. The SDK router does not issue JWTs or serve a JWKS document; your provider must issue signed JWTs and you must publish the matching JWKS.
- Both modules can serve `/.well-known/oauth-protected-resource/<path>`; if both do, whichever controller Nest registers first answers. Set `serveProtectedResourceMetadata: false` on `McpOAuthModule`, as above, so `McpAuthModule` serves it with its auto-discovered `scopes_supported`. (Setting it on `McpAuthModule` instead also works, but loses those.)
- `McpAuthModule.configureJwt()` requires `audience` (or `resourceIdentifier`). Have your provider issue tokens with the MCP server's URL in `aud`.

### Full-stack example

```typescript
import { Module } from '@nestjs/common';
import { McpHttpModule } from '@onivoro/server-mcp';
import { McpAuthModule, McpJwtAuthStrategy } from '@onivoro/server-mcp-auth';
import { McpOAuthModule } from '@onivoro/server-mcp-oauth';
import { MyOAuthProvider } from './my-oauth-provider';

@Module({
  imports: [
    McpOAuthModule.configure({
      provider: MyOAuthProvider,
      issuerUrl: 'https://auth.example.com',
      resourceServerUrl: 'https://api.example.com/mcp',
      scopesSupported: ['read', 'write'],
      serveProtectedResourceMetadata: false,
    }),
    McpAuthModule.configureJwt({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      issuer: 'https://auth.example.com',
      audience: 'https://api.example.com/mcp',
      resourceServerUrl: 'https://api.example.com/mcp',
    }),
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '1.0.0' },
      authStrategy: McpJwtAuthStrategy,
      requireBearerAuth: true,
    }),
  ],
})
export class AppModule {}
```

If this same app is bolted onto an existing Nest server with `app.setGlobalPrefix('api')`, exclude the OAuth routes from the prefix (see [Standalone vs bolted-on apps](#standalone-vs-bolted-on-apps)), set `resourceServerUrl: 'https://api.example.com/api/mcp'` in both modules, and keep `McpHttpModule.registerAndServeHttp({ route: 'mcp', ... })`.

## Tested behavior

The package test suite covers the following, using a mocked SDK router except where noted:

- route mounting for OAuth discovery endpoints, and leaving the PRM route out with `serveProtectedResourceMetadata: false`
- Client ID Metadata Documents through the SDK's real router (metadata, authorization, `redirect_uri` checks, turning it off), and the document checks, caching and private-address blocking
- `configureAsync()` with DI-resolved class providers
- composition with unprotected and protected MCP routes
- config URL validation
- the path-based PRM route on Nest 10. Nest 11 (GET and OPTIONS) is checked by the repository's `npm run smoke:nest11`, which runs locally, not in CI

## Troubleshooting

- The MCP route is still unprotected
  Expected. Add `@onivoro/server-mcp-auth` plus `requireBearerAuth: true`, or provide your own verifier-backed auth strategy.
- Registered clients disappear after restart
  `McpMemoryClientsStore` is for development and testing. Replace it with a persistent store.
- Async provider class is not resolving
  Ensure the provider class is actually available in the Nest container through `imports`/`providers`.

## Platform requirement

Requires NestJS Express platform (`@nestjs/platform-express`). The SDK's auth router is Express middleware.

## Exports

| Export                                                                                                                       | Type       | Description                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `McpOAuthModule`                                                                                                             | Module     | Dynamic module with `configure()` / `configureAsync()` (deprecated aliases `register()` / `registerAsync()`)                  |
| `McpOAuthConfig`                                                                                                             | Interface  | Configuration options                                                                                                         |
| `McpOAuthAsyncOptions`                                                                                                       | Interface  | Async factory options                                                                                                         |
| `MCP_OAUTH_CONFIG`                                                                                                           | Symbol     | Injection token for config                                                                                                    |
| `MCP_OAUTH_SERVER_PROVIDER`                                                                                                  | Symbol     | Injection token for the resolved `OAuthServerProvider`                                                                        |
| `McpMemoryClientsStore`                                                                                                      | Service    | In-memory `OAuthRegisteredClientsStore` for dev/testing: `getClient()`, `registerClient()`, `seedClient()`, `clear()`, `size` |
| `McpClientIdMetadataDocumentStore`                                                                                           | Class      | Clients store that resolves metadata document URLs and passes other client IDs to a wrapped store                             |
| `McpClientIdMetadataDocumentOptions`                                                                                         | Interface  | `{ cacheTtlMs?, maxBytes?, timeoutMs?, allowPrivateNetwork?, fetchDocument? }`                                                |
| `isClientIdMetadataDocumentUrl`, `parseClientIdMetadataDocument`, `fetchClientIdMetadataDocument`, `isPrivateNetworkAddress` | Functions  | The checks and fetch the store uses                                                                                           |
| `McpOAuthClientsStoreLike`, `McpClientIdMetadataDocumentResponse`                                                            | Interfaces | The clients store the wrapper accepts; what `fetchDocument` resolves to (`{ status, body, maxAgeSeconds? }`)                  |

The module exports `MCP_OAUTH_CONFIG`, `MCP_OAUTH_SERVER_PROVIDER`, and `McpMemoryClientsStore` to importing modules.
