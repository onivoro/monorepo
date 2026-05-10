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

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/.well-known/oauth-authorization-server` | GET | Authorization server metadata (RFC 8414) |
| `/.well-known/oauth-protected-resource` | GET | Protected resource metadata (RFC 9728) |
| `/authorize` | GET/POST | Authorization endpoint |
| `/token` | POST | Token endpoint |
| `/register` | POST | Dynamic client registration (RFC 7591) |
| `/revoke` | POST | Token revocation (RFC 7009) |

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

This package mounts OAuth authorization-server endpoints in the Nest route space. In a standalone auth server they are exposed at paths such as `/authorize`, `/token`, `/register`, `/revoke`, and `/.well-known/oauth-authorization-server`. In an existing app with `app.setGlobalPrefix('api')`, those endpoints are exposed under `/api` unless you exclude them when setting the global prefix.

Set URL fields to the public URLs clients actually use:

| Field | Standalone example | Existing app with `app.setGlobalPrefix('api')` |
|-------|--------------------|-----------------------------------------------|
| `issuerUrl` | `https://auth.example.com` | `https://auth.example.com` |
| `baseUrl` | `https://auth.example.com` | `https://auth.example.com/api` |
| `resourceServerUrl` | `https://api.example.com/mcp` | `https://api.example.com/api/mcp` |

`resourceServerUrl` is the protected MCP resource URL, not the OAuth server URL. If your MCP app uses `route: 'internal/mcp'` behind a global `api` prefix, use `https://api.example.com/api/internal/mcp`.

## Provider options

### Class reference (DI-resolved)

The provider class is resolved through NestJS DI, so it can inject other services:

```typescript
@Injectable()
class MyOAuthProvider implements OAuthServerProvider {
  constructor(
    private readonly db: DatabaseService,
    private readonly clientsStore: McpMemoryClientsStore,
  ) {}

  get clientsStore() { return this.clientsStore; }
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

`configureAsync()` also supports class-based providers. The class just needs to be available in the Nest container:

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
})
```

## Configuration

### `McpOAuthConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `provider` | `OAuthServerProvider \| class` | *required* | Auth server implementation (instance or class) |
| `issuerUrl` | `string` | *required* | Authorization server issuer URL |
| `baseUrl` | `string?` | `issuerUrl` | Base URL for auth endpoints |
| `scopesSupported` | `string[]?` | — | Scopes this server supports |
| `resourceName` | `string?` | — | Human-readable resource name |
| `resourceServerUrl` | `string?` | `baseUrl` | Public MCP endpoint URL protected by this authorization server |
| `serviceDocumentationUrl` | `string?` | — | Service docs URL |
| `authorizationOptions` | `object?` | — | SDK authorization handler options |
| `tokenOptions` | `object?` | — | SDK token handler options |
| `clientRegistrationOptions` | `object?` | — | SDK registration handler options |
| `revocationOptions` | `object?` | — | SDK revocation handler options |

All URL fields must be absolute URLs. Invalid values fail fast during module initialization.

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

// Clear between tests
store.clear();
```

For production, implement `OAuthRegisteredClientsStore` with a persistent backend (database, Redis, etc.).

If `McpMemoryClientsStore` is actually used to register clients outside tests, the package logs a warning because registered clients will be lost on process restart.

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

If this same app is bolted onto an existing Nest server with `app.setGlobalPrefix('api')`, set `baseUrl: 'https://auth.example.com/api'`, set `resourceServerUrl: 'https://api.example.com/api/mcp'`, and keep `McpHttpModule.registerAndServeHttp({ route: 'mcp', ... })`.

## Tested behavior

The package test suite covers:

- route mounting for OAuth discovery endpoints
- `configureAsync()` with DI-resolved class providers
- composition with unprotected and protected MCP routes
- config URL validation

## Troubleshooting

- The MCP route is still unprotected
  Expected. Add `@onivoro/server-mcp-auth` plus `requireBearerAuth: true`, or provide your own verifier-backed auth strategy.
- Registered clients disappear after restart
  `McpMemoryClientsStore` is for development and testing. Replace it with a persistent store.
- Async provider class is not resolving
  Ensure the provider class is actually available in the Nest container through `imports`/`providers`.

## Tested wrapper behavior

The wrapper itself is covered for these scenarios:

- auth-server discovery endpoints are mounted in a Nest app
- `McpOAuthModule` alone does not protect the MCP route
- composition with `McpAuthModule` and `McpHttpModule` does protect the MCP route
- `configureAsync()` supports DI-resolved class providers

## Platform requirement

Requires NestJS Express platform (`@nestjs/platform-express`). The SDK's auth router is Express middleware.

## Exports

| Export | Type | Description |
|--------|------|-------------|
| `McpOAuthModule` | Module | Dynamic module with `configure()` / `configureAsync()` |
| `McpOAuthConfig` | Interface | Configuration options |
| `McpOAuthAsyncOptions` | Interface | Async factory options |
| `MCP_OAUTH_CONFIG` | Symbol | Injection token for config |
| `MCP_OAUTH_SERVER_PROVIDER` | Symbol | Injection token for the resolved `OAuthServerProvider` |
| `McpMemoryClientsStore` | Service | In-memory client store for dev/testing |
