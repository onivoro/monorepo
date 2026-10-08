# @onivoro/server-mcp-oauth

Embedded OAuth 2.1 authorization server for MCP. Wraps the MCP SDK's `OAuthServerProvider` infrastructure into NestJS modules.

## Start here

Use this package only when your system needs to act as the OAuth authorization server.

If you just need to validate JWTs from Cognito, Auth0, Entra, or another external provider, use `@onivoro/server-mcp-auth` instead.

If you are deciding how the packages fit together, start with:
[MCP Server Package Guide](https://github.com/onivoro/monorepo/blob/main/libs/server/mcp-package-guide.md)

## Installation

```bash
npm install @onivoro/server-mcp-oauth
```

**Peer dependencies:** `@modelcontextprotocol/sdk`, `@nestjs/common`, `@nestjs/core`

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

| Endpoint                                               | Method       | Description                                                                                                                                                                                |
| ------------------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/.well-known/oauth-authorization-server`              | GET, OPTIONS | Authorization server metadata (RFC 8414)                                                                                                                                                   |
| `/.well-known/oauth-protected-resource<resource path>` | GET, OPTIONS | Protected resource metadata (RFC 9728), served at the path of `resourceServerUrl` (e.g. `/.well-known/oauth-protected-resource/mcp`). The bare path answers only when that URL has no path |
| `/authorize`                                           | GET, POST    | Authorization endpoint                                                                                                                                                                     |
| `/token`                                               | POST         | Token endpoint                                                                                                                                                                             |
| `/register`                                            | POST         | Dynamic client registration (RFC 7591), only when `provider.clientsStore.registerClient` exists                                                                                            |
| `/revoke`                                              | POST         | Token revocation (RFC 7009), only when `provider.revokeToken` exists                                                                                                                       |

Behavior inherited from the SDK router:

- `issuerUrl` must be HTTPS unless the host is `localhost` or `127.0.0.1` (or `MCP_DANGEROUSLY_ALLOW_INSECURE_ISSUER_URL=true` is set), and must have no query or fragment.
- Endpoints are rate-limited by default; tune or disable that with `authorizationOptions`, `tokenOptions`, `clientRegistrationOptions`, and `revocationOptions`.
- The PRM document lists `issuerUrl` as the only authorization server.
- A request on one of these routes that the router does not handle gets a `404`.

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
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
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
import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';

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

| Field                       | Type                           | Default                     | Description                                                                                             |
| --------------------------- | ------------------------------ | --------------------------- | ------------------------------------------------------------------------------------------------------- |
| `provider`                  | `OAuthServerProvider \| class` | _required_                  | Auth server implementation (instance or class)                                                          |
| `issuerUrl`                 | `string`                       | _required_                  | Authorization server issuer URL                                                                         |
| `baseUrl`                   | `string?`                      | `issuerUrl`                 | Origin for the advertised endpoint URLs (its path is ignored by the SDK)                                |
| `scopesSupported`           | `string[]?`                    | —                           | Scopes this server supports                                                                             |
| `resourceName`              | `string?`                      | —                           | Human-readable resource name in PRM                                                                     |
| `resourceServerUrl`         | `string?`                      | `baseUrl`, then `issuerUrl` | Public MCP endpoint URL protected by this authorization server. Sets the PRM `resource` field and route |
| `serviceDocumentationUrl`   | `string?`                      | —                           | Service docs URL (AS metadata `service_documentation`, PRM `resource_documentation`)                    |
| `authorizationOptions`      | `object?`                      | —                           | SDK authorization handler options                                                                       |
| `tokenOptions`              | `object?`                      | —                           | SDK token handler options                                                                               |
| `clientRegistrationOptions` | `object?`                      | —                           | SDK registration handler options                                                                        |
| `revocationOptions`         | `object?`                      | —                           | SDK revocation handler options                                                                          |

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
})
```

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
    }),
    McpAuthModule.configureJwt({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      issuer: 'https://auth.example.com',
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
- When both modules point at the same `resourceServerUrl`, both serve `/.well-known/oauth-protected-resource/<path>`, and the controller Nest registers first answers. To have one source, set `serveProtectedResourceMetadata: false` on `McpAuthModule` (you then lose its auto-discovered `scopes_supported`).

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
    }),
    McpAuthModule.configureJwt({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      issuer: 'https://auth.example.com',
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

The package test suite covers the following, using a mocked SDK router (the SDK's own handlers are not exercised):

- route mounting for OAuth discovery endpoints
- `configureAsync()` with DI-resolved class providers
- composition with unprotected and protected MCP routes
- config URL validation
- the Nest 10 / Nest 11 wildcard syntax for the path-based PRM route

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

| Export                      | Type      | Description                                                                                                                   |
| --------------------------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `McpOAuthModule`            | Module    | Dynamic module with `configure()` / `configureAsync()` (deprecated aliases `register()` / `registerAsync()`)                  |
| `McpOAuthConfig`            | Interface | Configuration options                                                                                                         |
| `McpOAuthAsyncOptions`      | Interface | Async factory options                                                                                                         |
| `MCP_OAUTH_CONFIG`          | Symbol    | Injection token for config                                                                                                    |
| `MCP_OAUTH_SERVER_PROVIDER` | Symbol    | Injection token for the resolved `OAuthServerProvider`                                                                        |
| `McpMemoryClientsStore`     | Service   | In-memory `OAuthRegisteredClientsStore` for dev/testing: `getClient()`, `registerClient()`, `seedClient()`, `clear()`, `size` |

The module exports `MCP_OAUTH_CONFIG`, `MCP_OAUTH_SERVER_PROVIDER`, and `McpMemoryClientsStore` to importing modules.
