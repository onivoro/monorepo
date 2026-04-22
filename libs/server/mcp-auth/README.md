# @onivoro/server-mcp-auth

Resource server auth for MCP servers built with `@onivoro/server-mcp`. Validates incoming JWT tokens, enriches auth context, auto-discovers scopes, and serves RFC 9728 Protected Resource Metadata.

## Installation

```bash
npm install @onivoro/server-mcp-auth
```

**Peer dependencies:** `@onivoro/server-mcp`, `@modelcontextprotocol/sdk`, `@nestjs/common`, `@nestjs/core`, `jsonwebtoken`, `jwks-rsa`

## Quick start

```typescript
import { Module } from '@nestjs/common';
import { McpHttpModule } from '@onivoro/server-mcp';
import { McpAuthModule, McpJwtAuthProvider } from '@onivoro/server-mcp-auth';

@Module({
  imports: [
    McpAuthModule.register({
      jwksUri: 'https://cognito-idp.us-east-1.amazonaws.com/<pool>/.well-known/jwks.json',
      issuer: 'https://cognito-idp.us-east-1.amazonaws.com/<pool>',
      audience: '<client-id>',
      resourceServerUrl: 'https://api.example.com/mcp',
      authorizationServers: ['https://cognito-idp.us-east-1.amazonaws.com/<pool>'],
    }),
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '1.0.0' },
      authProvider: McpJwtAuthProvider,
    }),
  ],
})
export class AppModule {}
```

`McpAuthModule` makes `McpJwtAuthProvider` available in the DI container. `McpHttpModule` resolves it via the `authProvider` class reference. The provider validates every incoming request's JWT before guards run.

## What you get

| Feature | Description |
|---------|-------------|
| **JWT validation** | Signature verification via JWKS, issuer/audience/expiry checks |
| **Auth enrichment** | Extracts `clientId`, `scopes`, `expiresAt`, and custom claims into `McpAuthInfo` |
| **Scope auto-discovery** | Collects all scopes from `@McpGuard(McpScopeGuard, { scopes })` across tools |
| **Protected Resource Metadata** | Serves `/.well-known/oauth-protected-resource` (RFC 9728) |
| **SDK compatibility** | Implements both `McpAuthProvider` and the SDK's `OAuthTokenVerifier` |
| **Testing utilities** | `McpTestAuthProvider`, `createMockAuthInfo()`, `createMockJwt()` |

## Configuration

### `McpAuthConfig`

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `jwksUri` | `string` | *required* | JWKS endpoint URL |
| `issuer` | `string?` | — | Expected JWT issuer (`iss` claim) |
| `audience` | `string?` | — | Expected audience (`aud` claim) |
| `algorithms` | `string[]?` | `['RS256']` | Accepted signing algorithms |
| `clientIdClaim` | `string?` | `'client_id'` | JWT claim for client ID. Cognito: `'client_id'`, Auth0: `'azp'`, Entra: `'appid'` |
| `scopeClaim` | `string?` | `'scope'` | JWT claim for scopes. Auth0: `'permissions'` |
| `scopeFormat` | `'string' \| 'array' \| 'auto'` | `'auto'` | Whether scope claim is space-delimited or array |
| `extraClaims` | `Record<string, string>?` | — | Map JWT claim names to `McpAuthInfo.extra` keys |
| `resourceIdentifier` | `string?` | — | RFC 8707 resource indicator |
| `resourceServerUrl` | `string?` | — | Base URL for PRM `resource` field |
| `authorizationServers` | `string[]?` | — | Auth server URLs for PRM |
| `serveProtectedResourceMetadata` | `boolean?` | `true` | Serve `/.well-known/oauth-protected-resource` |
| `resourceName` | `string?` | — | Human-readable name for PRM |
| `resourceDocumentationUrl` | `string?` | — | Docs URL for PRM |
| `jwksCache` | `boolean?` | `true` | Cache JWKS responses |
| `jwksCacheMaxAge` | `number?` | `600_000` | Cache TTL in ms |
| `jwksRateLimit` | `boolean?` | `true` | Rate-limit JWKS requests |
| `jwksRequestsPerMinute` | `number?` | `10` | Max JWKS requests per minute |

### Async configuration

```typescript
McpAuthModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    jwksUri: config.get('JWKS_URI'),
    issuer: config.get('JWT_ISSUER'),
    audience: config.get('JWT_AUDIENCE'),
  }),
})
```

## Provider-specific examples

### AWS Cognito

```typescript
McpAuthModule.register({
  jwksUri: `https://cognito-idp.${region}.amazonaws.com/${poolId}/.well-known/jwks.json`,
  issuer: `https://cognito-idp.${region}.amazonaws.com/${poolId}`,
  audience: clientId,
  clientIdClaim: 'client_id',
  scopeClaim: 'scope',
})
```

### Auth0

```typescript
McpAuthModule.register({
  jwksUri: `https://${domain}/.well-known/jwks.json`,
  issuer: `https://${domain}/`,
  audience: apiIdentifier,
  clientIdClaim: 'azp',
  scopeClaim: 'permissions',
  scopeFormat: 'array',
})
```

### Microsoft Entra ID

```typescript
McpAuthModule.register({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  audience: clientId,
  clientIdClaim: 'appid',
  extraClaims: { 'tid': 'tenantId', 'oid': 'objectId' },
})
```

## Execution pipeline

When a tool is called, the auth provider runs as stage 2 of the pipeline:

| Stage | Component | Role |
|-------|-----------|------|
| 1 | Transport | Extracts raw `authInfo` from the HTTP/stdio request |
| 2 | **McpJwtAuthProvider** | Validates JWT, enriches `McpAuthInfo` with decoded claims |
| 3 | Guards | Check scopes, roles, or custom rules against enriched auth |
| 4 | Validation | Zod schema validation of tool params |
| 5 | Interceptors | Cross-cutting concerns (logging, metrics) |
| 6 | Handler | Tool implementation |

## McpScopeRegistry

Auto-discovers all scopes declared via `@McpGuard(McpScopeGuard, { scopes: [...] })`:

```typescript
@McpTool('delete-item', 'Delete an item', schema)
@McpGuard(McpScopeGuard, { scopes: ['write', 'admin'] })
async deleteItem(params: DeleteParams) { ... }
```

The `McpScopeRegistry` collects `['write', 'admin']` and exposes them via `getScopesArray()`. These are automatically included in the Protected Resource Metadata `scopes_supported` field.

Dynamically registered tools are picked up via `McpToolRegistry.onRegistrationChange()`.

## Testing

```typescript
import { McpTestAuthProvider, createMockAuthInfo, createMockJwt } from '@onivoro/server-mcp-auth';

// Use McpTestAuthProvider in integration tests
const module = await Test.createTestingModule({
  imports: [
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'test', version: '1.0.0' },
      authProvider: McpTestAuthProvider,
    }),
  ],
}).compile();

const testAuth = module.get(McpTestAuthProvider);
testAuth.setAuthInfo(createMockAuthInfo({ scopes: ['admin'], extra: { userId: 'u-1' } }));

// createMockJwt for unit tests (decodable but unsigned)
const token = createMockJwt({ sub: 'test-user', scope: 'read write' });
```

## Exports

| Export | Type | Description |
|--------|------|-------------|
| `McpAuthModule` | Module | Dynamic module with `register()` / `registerAsync()` |
| `McpAuthConfig` | Interface | Configuration options |
| `McpAuthAsyncOptions` | Interface | Async factory options |
| `MCP_AUTH_CONFIG` | Symbol | Injection token for config |
| `McpJwtAuthProvider` | Service | JWT auth provider — implements `McpAuthProvider` + `OAuthTokenVerifier` |
| `McpJwksService` | Service | JWKS key fetching with caching and rate limiting |
| `McpScopeRegistry` | Service | Auto-discovers scopes from guard metadata |
| `McpProtectedResourceController` | Controller | RFC 9728 metadata endpoint |
| `McpTestAuthProvider` | Service | Test-friendly auth provider |
| `createMockAuthInfo` | Function | Factory for test `McpAuthInfo` objects |
| `createMockJwt` | Function | Creates decodable unsigned JWTs for testing |
