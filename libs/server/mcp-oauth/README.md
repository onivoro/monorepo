# @onivoro/server-mcp-oauth

Embedded OAuth 2.1 authorization server for MCP. Wraps the MCP SDK's `OAuthServerProvider` infrastructure into NestJS modules.

Use this when your MCP server needs to BE the OAuth provider (no external Cognito/Auth0/Entra). For the more common case of validating tokens from an external provider, use [`@onivoro/server-mcp-auth`](https://www.npmjs.com/package/@onivoro/server-mcp-auth) instead.

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
    McpOAuthModule.register({
      provider: MyOAuthProvider,
      issuerUrl: 'https://auth.example.com',
      scopesSupported: ['read', 'write', 'admin'],
    }),
  ],
})
export class AppModule {}
```

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

- challenge unauthenticated MCP requests on `/mcp`
- validate bearer tokens for your MCP transport
- wire `authStrategy` into `McpHttpModule`

To protect `/mcp`, combine it with either:

- `@onivoro/server-mcp-auth` and `McpJwtAuthStrategy`
- or your own `authStrategy` that implements the MCP SDK `OAuthTokenVerifier` interface

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

McpOAuthModule.register({
  provider: MyOAuthProvider,
  issuerUrl: 'https://auth.example.com',
})
```

### Instance (e.g. ProxyOAuthServerProvider)

For proxying to an upstream OAuth server, pass an instance directly:

```typescript
import { ProxyOAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/providers/proxyProvider.js';

McpOAuthModule.register({
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

`registerAsync()` also supports class-based providers. The class just needs to be available in the Nest container:

```typescript
@Module({
  providers: [MyOAuthProvider],
  exports: [MyOAuthProvider],
})
class OAuthProviderModule {}

McpOAuthModule.registerAsync({
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
| `resourceServerUrl` | `string?` | `baseUrl` | Protected resource URL |
| `serviceDocumentationUrl` | `string?` | — | Service docs URL |
| `authorizationOptions` | `object?` | — | SDK authorization handler options |
| `tokenOptions` | `object?` | — | SDK token handler options |
| `clientRegistrationOptions` | `object?` | — | SDK registration handler options |
| `revocationOptions` | `object?` | — | SDK revocation handler options |

All URL fields must be absolute URLs. Invalid values fail fast during module initialization.

### Async configuration

```typescript
McpOAuthModule.registerAsync({
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
    McpOAuthModule.register({
      provider: MyOAuthProvider,
      issuerUrl: 'https://auth.example.com',
      scopesSupported: ['read', 'write'],
    }),
    McpAuthModule.register({
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
- HTTP `401` bearer challenges on `/mcp` from `McpHttpModule`

## Tested wrapper behavior

The wrapper itself is covered for these scenarios:

- auth-server discovery endpoints are mounted in a Nest app
- `McpOAuthModule` alone does not protect `/mcp`
- composition with `McpAuthModule` and `McpHttpModule` does protect `/mcp`
- `registerAsync()` supports DI-resolved class providers

## Platform requirement

Requires NestJS Express platform (`@nestjs/platform-express`). The SDK's auth router is Express middleware.

## Exports

| Export | Type | Description |
|--------|------|-------------|
| `McpOAuthModule` | Module | Dynamic module with `register()` / `registerAsync()` |
| `McpOAuthConfig` | Interface | Configuration options |
| `McpOAuthAsyncOptions` | Interface | Async factory options |
| `MCP_OAUTH_CONFIG` | Symbol | Injection token for config |
| `MCP_OAUTH_SERVER_PROVIDER` | Symbol | Injection token for the resolved `OAuthServerProvider` |
| `McpMemoryClientsStore` | Service | In-memory client store for dev/testing |
