# @onivoro/server-mcp-auth

Resource server auth for MCP servers built with [`@onivoro/server-mcp`](https://www.npmjs.com/package/@onivoro/server-mcp). Validates incoming JWT tokens, enriches auth context, auto-discovers scopes, and serves RFC 9728 Protected Resource Metadata.

## Start here

Use this package when your MCP server should trust tokens issued by an external provider such as Cognito, Auth0, Entra, or another JWKS-backed OAuth/OIDC server.

If you are choosing between the `@onivoro/server-mcp*` packages, start with:
[MCP Server Package Guide](https://github.com/onivoro/monorepo/blob/main/libs/server/mcp-package-guide.md)

## What this package does

- validates JWT bearer tokens using JWKS
- enriches MCP auth context before guards and handlers run
- serves Protected Resource Metadata for MCP auth discovery
- provides a tested `McpJwtAuthStrategy` that also implements the MCP SDK verifier interface
- provides `McpCognitoAuthStrategy`, a Cognito preset that also requires `token_use: 'access'` and a matching `client_id`

## What this package does not do

- publish OAuth authorization-server endpoints
- protect the MCP HTTP route by itself unless the transport also enables bearer challenges
- replace `@onivoro/server-mcp`

## Installation

```bash
npm install @onivoro/server-mcp-auth
```

**Peer dependencies:** `@modelcontextprotocol/sdk`, `@nestjs/common`, `@nestjs/core`, `jsonwebtoken`, `jwks-rsa`

`@onivoro/server-mcp` is a regular dependency and is installed automatically.

## Quick start

```typescript
import { Module } from '@nestjs/common';
import { McpHttpModule } from '@onivoro/server-mcp';
import { McpAuthModule, McpCognitoAuthStrategy } from '@onivoro/server-mcp-auth';

@Module({
  imports: [
    McpAuthModule.configureCognito({
      region: 'us-east-1',
      userPoolId: '<pool>',
      clientId: '<client-id>',
      resourceServerUrl: 'https://api.example.com/mcp',
    }),
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '1.0.0' },
      authStrategy: McpCognitoAuthStrategy,
      requireBearerAuth: true,
    }),
  ],
})
export class AppModule {}
```

`McpAuthModule` makes the selected strategy available in the DI container. `McpHttpModule` resolves that existing provider via the `authStrategy` class reference; it does not register the strategy on its own.

With `requireBearerAuth: true`, unauthenticated HTTP requests are rejected at the transport layer with a standards-compliant `401` challenge and `WWW-Authenticate` metadata. That is the configuration MCP HTTP clients need to trigger OAuth automatically.

Without `requireBearerAuth`, `McpJwtAuthStrategy` still validates and enriches auth during tool execution, but anonymous HTTP requests are not challenged automatically.

Import `McpAuthModule` in the same Nest application that imports `McpHttpModule.registerAndServeHttp()` or `McpStdioModule.registerAndServeStdio()`, otherwise Nest will not be able to resolve the selected auth strategy and its config dependencies.

## Standalone vs bolted-on servers

`resourceServerUrl` must be the public MCP endpoint URL. This package cannot infer that URL reliably because deployments may use Nest global prefixes, reverse proxies, custom domains, or custom MCP routes.

| App shape            | `McpHttpModule` route | Nest global prefix | Public MCP URL / `resourceServerUrl`       |
| -------------------- | --------------------- | ------------------ | ------------------------------------------ |
| Standalone default   | omitted or `'mcp'`    | none               | `https://api.example.com/mcp`              |
| Standalone custom    | `'internal/mcp'`      | none               | `https://api.example.com/internal/mcp`     |
| Existing app default | omitted or `'mcp'`    | `api`              | `https://api.example.com/api/mcp`          |
| Existing app custom  | `'internal/mcp'`      | `api`              | `https://api.example.com/api/internal/mcp` |

For MCP clients to start OAuth automatically, the same app should also import `McpHttpModule.registerAndServeHttp({ authStrategy: McpJwtAuthStrategy, requireBearerAuth: true })`. The auth module provides validation and metadata; the HTTP module sends the `401` challenge on the MCP route.

## What you get

| Feature                         | Description                                                                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **JWT validation**              | Signature verification via JWKS, issuer/audience/expiry checks                                                                                                             |
| **Auth enrichment**             | Extracts `clientId` (falls back to `sub`, then `'unknown'`), `scopes`, `expiresAt`, `resource` (from `resourceIdentifier`), and mapped claims (`extra`) into `McpAuthInfo` |
| **Scope auto-discovery**        | Collects all scopes from `@McpGuard(McpScopeGuard, { scopes })` across tools                                                                                               |
| **Protected Resource Metadata** | Serves `/.well-known/oauth-protected-resource` (RFC 9728)                                                                                                                  |
| **SDK compatibility**           | Implements both `McpAuthStrategy` and the SDK's `OAuthTokenVerifier`                                                                                                       |
| **Testing utilities**           | `McpTestAuthStrategy`, `createMockAuthInfo()`, `createMockJwt()`                                                                                                           |

## Configuration

### Minimum required config

Protected Resource Metadata is on by default, so `configureJwt()` throws at startup unless you either disable it or provide `resourceServerUrl` plus `issuer` or `authorizationServers`.

### For JWT validation only

```typescript
McpAuthModule.configureJwt({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  serveProtectedResourceMetadata: false,
});
```

### For Protected Resource Metadata

```typescript
McpAuthModule.configureJwt({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  issuer: 'https://auth.example.com',
  resourceServerUrl: 'https://api.example.com/mcp',
});
```

### For automatic MCP OAuth challenge flow

```typescript
McpAuthModule.configureJwt({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  issuer: 'https://auth.example.com',
  resourceServerUrl: 'https://api.example.com/mcp',
});

McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authStrategy: McpJwtAuthStrategy,
  requireBearerAuth: true,
});
```

Without `requireBearerAuth`, the strategy still validates tokens during tool execution, but MCP HTTP clients will not receive the transport-level `401` challenge they use to start OAuth automatically.

### `McpAuthConfig`

| Field                            | Type                            | Default       | Description                                                                                                          |
| -------------------------------- | ------------------------------- | ------------- | -------------------------------------------------------------------------------------------------------------------- |
| `jwksUri`                        | `string`                        | _required_    | JWKS endpoint URL                                                                                                    |
| `issuer`                         | `string?`                       | —             | Expected JWT issuer (`iss` claim)                                                                                    |
| `audience`                       | `string?`                       | —             | Expected audience (`aud` claim)                                                                                      |
| `algorithms`                     | `string[]?`                     | `['RS256']`   | Accepted signing algorithms                                                                                          |
| `clientIdClaim`                  | `string?`                       | `'client_id'` | JWT claim for client ID. Cognito: `'client_id'`, Auth0: `'azp'`, Entra: `'appid'`                                    |
| `scopeClaim`                     | `string?`                       | `'scope'`     | JWT claim for scopes. Auth0: `'permissions'`                                                                         |
| `scopeFormat`                    | `'string' \| 'array' \| 'auto'` | `'auto'`      | Whether scope claim is space-delimited or array                                                                      |
| `extraClaims`                    | `Record<string, string>?`       | —             | Map JWT claim names to `McpAuthInfo.extra` keys                                                                      |
| `resourceIdentifier`             | `string?`                       | —             | RFC 8707 resource indicator. When set, the token's `aud` must include it, and it is copied to `McpAuthInfo.resource` |
| `resourceServerUrl`              | `string?`                       | —             | Public MCP endpoint URL for PRM `resource` field                                                                     |
| `authorizationServers`           | `string[]?`                     | `[issuer]`    | Auth server URLs for PRM. When omitted, PRM advertises `issuer`                                                      |
| `serveProtectedResourceMetadata` | `boolean?`                      | `true`        | Serve `/.well-known/oauth-protected-resource`                                                                        |
| `protectedResourceMetadataMode`  | `'root' \| 'path' \| 'both'`    | `'both'`      | Which RFC 9728 discovery routes to serve                                                                             |
| `resourceName`                   | `string?`                       | —             | Human-readable name for PRM                                                                                          |
| `resourceDocumentationUrl`       | `string?`                       | —             | Docs URL for PRM                                                                                                     |
| `jwksCache`                      | `boolean?`                      | `true`        | Cache JWKS responses                                                                                                 |
| `jwksCacheMaxAge`                | `number?`                       | `600_000`     | Cache TTL in ms                                                                                                      |
| `jwksRateLimit`                  | `boolean?`                      | `true`        | Rate-limit JWKS requests                                                                                             |
| `jwksRequestsPerMinute`          | `number?`                       | `10`          | Max JWKS requests per minute                                                                                         |

### Async configuration

```typescript
McpAuthModule.configureJwtAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    jwksUri: config.getOrThrow('JWKS_URI'),
    issuer: config.getOrThrow('JWT_ISSUER'),
    audience: config.get('JWT_AUDIENCE'),
    resourceServerUrl: config.getOrThrow('MCP_RESOURCE_URL'),
  }),
});
```

The async variants (`configureJwtAsync()`, `configureCognitoAsync()`) always register `McpProtectedResourceController`, because the config is not known when the module is built. With `serveProtectedResourceMetadata: false` the routes respond `404`.

`register()` and `registerAsync()` remain as deprecated aliases for `configureJwt()` and `configureJwtAsync()`.

## Provider-specific examples

### AWS Cognito

```typescript
McpAuthModule.configureCognito({
  region,
  userPoolId: poolId,
  clientId,
  resourceServerUrl: 'https://api.example.com/mcp',
});
```

`configureCognito()` derives the JWT config for you: the issuer is `https://cognito-idp.<region>.amazonaws.com/<userPoolId>`, the JWKS URI is `<issuer>/.well-known/jwks.json`, the client ID comes from `client_id`, and scopes come from the space-delimited `scope` claim. PRM advertises the issuer as the authorization server unless you pass `authorizationServers`.

Use `authStrategy: McpCognitoAuthStrategy` with it. On top of the JWT checks, the strategy rejects any token whose `token_use` is not `'access'` (so ID tokens are refused) or whose `client_id` is not exactly the configured `clientId`. The MCP route accepts only that one app client.

#### `McpCognitoAuthConfig`

| Field                                                                                                                                                                                                                                | Type                      | Description                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `region`                                                                                                                                                                                                                             | `string`                  | _Required._ AWS region of the user pool                                                                |
| `userPoolId`                                                                                                                                                                                                                         | `string`                  | _Required._ Cognito user pool ID                                                                       |
| `clientId`                                                                                                                                                                                                                           | `string`                  | _Required._ The only app client whose access tokens the MCP route accepts                              |
| `inProcessClientIds`                                                                                                                                                                                                                 | `string[]?`               | Other app clients whose access tokens `verifyInProcessAccessToken()` also accepts; never the MCP route |
| `extraClaims`                                                                                                                                                                                                                        | `Record<string, string>?` | Map token claims to `McpAuthInfo.extra` keys                                                           |
| `resourceServerUrl`, `authorizationServers`, `serveProtectedResourceMetadata`, `protectedResourceMetadataMode`, `resourceName`, `resourceDocumentationUrl`, `jwksCache`, `jwksCacheMaxAge`, `jwksRateLimit`, `jwksRequestsPerMinute` |                           | Same as in `McpAuthConfig`                                                                             |

`audience`, `algorithms`, and `resourceIdentifier` are not available on the Cognito preset. Missing `region`, `userPoolId`, or `clientId`, or an empty entry in `inProcessClientIds`, throws at startup.

```typescript
McpAuthModule.configureCognitoAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (config: ConfigService) => ({
    region: config.getOrThrow('AWS_REGION'),
    userPoolId: config.getOrThrow('COGNITO_USER_POOL_ID'),
    clientId: config.getOrThrow('COGNITO_CLIENT_ID'),
    resourceServerUrl: config.getOrThrow('MCP_RESOURCE_URL'),
    extraClaims: { username: 'username' },
  }),
});
```

#### Verifying tokens for in-process callers

An agentic loop inside your app may call the MCP tools in-process on behalf of a signed-in user, carrying your web app's access token. The MCP route rejects that token, since only `clientId` is accepted there. List the web app client in `inProcessClientIds` and verify such tokens with `verifyInProcessAccessToken()`, then mark the result with `markMcpAuthInfoResolved()` from `@onivoro/server-mcp` so the registry does not run the strategy again:

```typescript
McpAuthModule.configureCognito({
  region,
  userPoolId,
  clientId: mcpToolingClientId,
  inProcessClientIds: [webAppClientId],
  resourceServerUrl: 'https://api.example.com/mcp',
});

const authInfo = markMcpAuthInfoResolved(await cognitoStrategy.verifyInProcessAccessToken(webAppAccessToken));
```

`verifyInProcessAccessToken()` runs the same signature, issuer, expiry and `token_use: 'access'` checks as the MCP route, accepts `client_id` values from `clientId` and `inProcessClientIds`, and throws `InvalidTokenError` otherwise. The MCP route's own checks (`resolveAuth()` and `verifyAccessToken()`) are unchanged. `@onivoro/server-agentic-mcp`'s `resolveAgenticMcpAuth()` wraps this flow for agentic chat.

### Auth0

```typescript
McpAuthModule.configureJwt({
  jwksUri: `https://${domain}/.well-known/jwks.json`,
  issuer: `https://${domain}/`,
  audience: apiIdentifier,
  clientIdClaim: 'azp',
  scopeClaim: 'permissions',
  scopeFormat: 'array',
  resourceServerUrl: 'https://api.example.com/mcp',
});
```

### Microsoft Entra ID

```typescript
McpAuthModule.configureJwt({
  jwksUri: `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
  issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  audience: clientId,
  clientIdClaim: 'appid',
  extraClaims: { tid: 'tenantId', oid: 'objectId' },
  resourceServerUrl: 'https://api.example.com/mcp',
});
```

## Execution pipeline

When `requireBearerAuth` is enabled, HTTP auth happens before MCP request handling. After that, the auth strategy still runs during tool execution:

| Stage | Component                              | Role                                                                                                                                                     |
| ----- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1     | Transport                              | Extracts raw `authInfo` from the HTTP/stdio request                                                                                                      |
| 2     | **McpJwtAuthStrategy** (`resolveAuth`) | Validates JWT, enriches `McpAuthInfo` with decoded claims. Invalid tokens throw `InvalidTokenError`; a missing token resolves to `undefined` (anonymous) |
| 3     | Guards                                 | Check scopes, roles, or custom rules against enriched auth                                                                                               |
| 4     | Validation                             | Schema validation of tool params                                                                                                                         |
| 5     | Interceptors                           | Cross-cutting concerns (logging, metrics)                                                                                                                |
| 6     | Handler                                | Tool implementation                                                                                                                                      |

## McpScopeRegistry

Auto-discovers all scopes declared via `@McpGuard(McpScopeGuard, { scopes: [...] })`:

```typescript
@McpTool({ name: 'delete-item', description: 'Delete an item', schema })
@McpGuard(McpScopeGuard, { scopes: ['write', 'admin'] })
async deleteItem(params: DeleteParams) { ... }
```

The `McpScopeRegistry` collects `['write', 'admin']` and exposes them via `getScopes()` (a `ReadonlySet`) and `getScopesArray()` (sorted). These are automatically included in the Protected Resource Metadata `scopes_supported` field.

Dynamically registered tools are picked up via `McpToolRegistry.onRegistrationChange()`. If no `McpToolRegistry` is in the container (no `McpHttpModule`, `McpStdioModule`, or `McpRegistryModule`), discovery is skipped and both methods return empty results.

## Protected Resource Metadata routes

When `serveProtectedResourceMetadata` is enabled, this package can serve:

- Root discovery: `/.well-known/oauth-protected-resource`
- Path-derived discovery: `/.well-known/oauth-protected-resource/<resource-path>`

Choose the route mode with `protectedResourceMetadataMode`:

- `'root'`: serve only the root route
- `'path'`: serve only the path-derived route for `resourceServerUrl`
- `'both'`: serve both routes for compatibility

`@onivoro/server-mcp` defaults its bearer challenge to the path-derived PRM URL for the actual request path. This supports both standalone MCP servers and existing Nest apps that use `app.setGlobalPrefix()`. For example, `route: 'mcp'` serves `/mcp` standalone and `/api/mcp` behind a global `api` prefix; the default challenge URLs are `/.well-known/oauth-protected-resource/mcp` and `/api/.well-known/oauth-protected-resource/api/mcp` respectively.

If you need to advertise the root route instead, set `requireBearerAuth: { resourceMetadataUrl: '/.well-known/oauth-protected-resource' }` in `McpHttpModule`.

## Tested behavior

The package test suite covers:

- JWT validation and enrichment
- `resourceIdentifier` enforcement
- Protected Resource Metadata route modes
- config validation
- composition with `McpHttpModule` for real HTTP `401` challenges

## Troubleshooting

- Tool calls still work anonymously
  You likely configured `McpJwtAuthStrategy` but did not enable `requireBearerAuth` in `McpHttpModule`.
- PRM is not discoverable
  Set `resourceServerUrl`, and ensure `serveProtectedResourceMetadata` is not disabled.
- Startup fails on auth config
  That is expected for invalid PRM config. When PRM is enabled, `resourceServerUrl` and an authorization-server source (`authorizationServers` or `issuer`) are required.
- Cognito tokens are rejected with `unexpected client_id`
  On the MCP route, `McpCognitoAuthStrategy` accepts access tokens from exactly one app client, the configured `clientId`; `inProcessClientIds` only applies to `verifyInProcessAccessToken()`. ID tokens are rejected because their `token_use` is `id`.
- JWT validation fails for the wrong issuer or audience
  Verify `issuer`, `audience`, and `resourceIdentifier` against the provider’s actual token claims.

## Testing

```typescript
import { McpTestAuthStrategy, createMockAuthInfo, createMockJwt } from '@onivoro/server-mcp-auth';

// Use McpTestAuthStrategy in integration tests.
// McpHttpModule resolves authStrategy from DI, so register it as a provider.
const module = await Test.createTestingModule({
  imports: [
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'test', version: '1.0.0' },
      authStrategy: McpTestAuthStrategy,
    }),
  ],
  providers: [McpTestAuthStrategy],
}).compile();

const testAuth = module.get(McpTestAuthStrategy);
testAuth.setAuthInfo(createMockAuthInfo({ scopes: ['admin'], extra: { userId: 'u-1' } }));
testAuth.setError(new Error('token revoked')); // make resolveAuth throw
testAuth.setAuthInfo(undefined); // simulate anonymous
testAuth.reset(); // pass the incoming authInfo through unchanged

// createMockJwt for unit tests (decodable but unsigned)
const token = createMockJwt({ sub: 'test-user', scope: 'read write' });
```

- `McpTestAuthStrategy` passes the incoming `authInfo` through until you call `setAuthInfo()` or `setError()`. It does not implement `verifyAccessToken`, so it cannot be combined with `requireBearerAuth`.
- `createMockAuthInfo(overrides?)` defaults to `clientId: 'test-client'`, `scopes: ['read']`, a random token, and an expiry one hour out.
- `createMockJwt(claims?)` defaults to `sub: 'test-subject'`, `client_id: 'test-client'`, `scope: 'read write'`, `iss: 'https://test-issuer.example.com'`, and a one-hour `exp`, with header `kid: 'test-kid'`. The signature is not valid, so it will not pass `McpJwtAuthStrategy`; sign a token with a real key for that.

## Exports

| Export                           | Type       | Description                                                                                                      |
| -------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------- |
| `McpAuthModule`                  | Module     | Dynamic module with `configureJwt()`, `configureJwtAsync()`, `configureCognito()`, and `configureCognitoAsync()` |
| `McpCognitoAuthStrategy`         | Class      | Cognito-aware access-token verifier for `authStrategy` (extends `McpJwtAuthStrategy`)                            |
| `McpAuthConfig`                  | Interface  | Configuration options                                                                                            |
| `McpAuthAsyncOptions`            | Interface  | Async factory options for `configureJwtAsync()`                                                                  |
| `McpCognitoAuthConfig`           | Interface  | Options for `configureCognito()`                                                                                 |
| `McpCognitoAuthAsyncOptions`     | Interface  | Async factory options for `configureCognitoAsync()`                                                              |
| `MCP_AUTH_CONFIG`                | Symbol     | Injection token for the resolved `McpAuthConfig` (also provided by the Cognito methods)                          |
| `MCP_COGNITO_AUTH_CONFIG`        | Symbol     | Injection token for `McpCognitoAuthConfig` (Cognito methods only)                                                |
| `McpJwtAuthStrategy`             | Service    | JWT auth strategy — implements `McpAuthStrategy` + `OAuthTokenVerifier`                                          |
| `McpJwksService`                 | Service    | JWKS key fetching with caching and rate limiting; `getSigningKey(kid)` returns a PEM public key                  |
| `McpScopeRegistry`               | Service    | Auto-discovers scopes from guard metadata                                                                        |
| `McpProtectedResourceController` | Controller | RFC 9728 metadata endpoint                                                                                       |
| `McpTestAuthStrategy`            | Service    | Test-friendly auth strategy                                                                                      |
| `createMockAuthInfo`             | Function   | Factory for test `McpAuthInfo` objects                                                                           |
| `createMockJwt`                  | Function   | Creates decodable unsigned JWTs for testing                                                                      |
