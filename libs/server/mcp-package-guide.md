# MCP Server Package Guide

This guide explains how the `@onivoro/server-mcp*` packages fit together and how to choose the right composition for standalone MCP servers, MCP endpoints bolted onto existing NestJS HTTP apps, protected resource servers, and embedded OAuth servers.

## Package Fit

| Goal                                           | Packages                                           | Use this when                                                                                       |
| ---------------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Plain MCP server                               | `@onivoro/server-mcp`                              | You do not need auth, or auth is handled outside the MCP server.                                    |
| Protected MCP server with external OAuth/JWT   | `@onivoro/server-mcp` + `@onivoro/server-mcp-auth` | Cognito, Auth0, Entra, or another JWKS-backed provider issues tokens.                               |
| Embedded OAuth authorization server only       | `@onivoro/server-mcp-oauth` (deprecated)           | Your app owns `/authorize`, `/token`, `/register`, and `/revoke`, but does not itself expose tools. |
| Embedded OAuth server plus protected MCP route | all three packages (`mcp-oauth` deprecated)        | Your app both issues tokens and serves protected MCP tools.                                         |

## Mental Model

`@onivoro/server-mcp` serves the MCP transport route and discovers tools. `@onivoro/server-mcp-auth` validates access tokens and serves Protected Resource Metadata. `@onivoro/server-mcp-oauth` serves authorization-server endpoints. They are intentionally separate so consumers can compose only the responsibilities they need.

`@onivoro/server-mcp-oauth` is **deprecated**. The MCP SDK has frozen the authorization-server helpers it wraps (`@modelcontextprotocol/server-legacy`, planned for removal in the SDK's v3), the spec classifies MCP servers as resource servers that point to a separate authorization server, and spec 2026-07-28 deprecates the dynamic client registration those helpers implement. For new work, run a dedicated authorization server and use the protected-server shapes below; the embedded-OAuth shapes are kept for existing users. See its README for the details and a migration path.

The MCP HTTP route is configured with `route`, not with an absolute path. It is relative to the Nest application route space and therefore respects `app.setGlobalPrefix()`.

| Host app shape                                 | `route`            | Public MCP endpoint |
| ---------------------------------------------- | ------------------ | ------------------- |
| Standalone MCP app                             | omitted or `'mcp'` | `/mcp`              |
| Standalone MCP app                             | `'internal/mcp'`   | `/internal/mcp`     |
| Existing app with `app.setGlobalPrefix('api')` | omitted or `'mcp'` | `/api/mcp`          |
| Existing app with `app.setGlobalPrefix('api')` | `'internal/mcp'`   | `/api/internal/mcp` |

When auth is enabled, `resourceServerUrl` must be the public URL of the MCP endpoint that clients call. Include any reverse-proxy base path, Nest global prefix, and custom `route`.

## Protocol Versions

The packages are built on v2 of the MCP TypeScript SDK (`@modelcontextprotocol/server`), and every server serves both generations of the protocol on the same endpoint or stdio connection:

- **Spec 2026-07-28** clients are stateless: no `initialize`, no sessions. They follow changes on `subscriptions/listen` streams, and tools ask the user for input by returning `inputRequired(...)`.
- **2025-11-25 and earlier** clients use the `initialize` handshake and, on HTTP, optional sessions.

Write tools once; `inputRequired(...)` reaches clients of both eras. See `@onivoro/server-mcp`'s README.

## HTTP Session Model

`McpHttpModule.registerAndServeHttp()` is stateless by default. If you omit the `session` option, the server does not emit `Mcp-Session-Id`, and any request can be handled by any horizontally scaled instance. This is the recommended shape for load-balanced request/response tool servers where every request carries its own auth context. 2026-07-28 clients get everything in this mode: progress, logs, `inputRequired`, and change notifications on their listen streams. 2025-era clients get progress and logs, but no `inputRequired`, server-to-client requests, list-changed notifications or resource subscriptions.

Configure `session` only when 2025-era clients need those (or resumable SSE streams, or deliberate per-session server state):

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  session: {
    ttlMinutes: 30,
  },
});
```

For resumable SSE streams, put the event store under `session`:

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  session: {
    eventStore,
  },
});
```

## Standalone Plain MCP Server

Use this shape for a dedicated MCP HTTP service with no auth.

```typescript
@Module({
  imports: [
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-server', version: '1.0.0' },
    }),
  ],
  providers: [MyToolService],
})
export class AppModule {}
```

Endpoint: `POST /mcp`.

## Bolted-On Plain MCP Route

Use this shape when an existing NestJS HTTP server should expose MCP tools with minimal structural change.

```typescript
@Module({
  imports: [
    ExistingFeatureModule,
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'my-existing-app-tools', version: '1.0.0' },
      route: 'mcp',
    }),
  ],
})
export class AppModule {}
```

```typescript
const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api');
await app.listen(3000);
```

Endpoint: `POST /api/mcp`.

## Protected MCP Server With External JWT/OAuth

Use this shape when another system issues access tokens and your MCP server only validates them.

```typescript
@Module({
  imports: [
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

For a bolted-on app with `app.setGlobalPrefix('api')`, use the public prefixed URL:

```typescript
McpAuthModule.configureJwt({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  issuer: 'https://auth.example.com',
  audience: 'https://api.example.com/api/mcp',
  resourceServerUrl: 'https://api.example.com/api/mcp',
});

McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  route: 'mcp',
  authStrategy: McpJwtAuthStrategy,
  requireBearerAuth: true,
});
```

`requireBearerAuth: true` is the switch that makes unauthenticated HTTP clients receive a standards-compliant `401` challenge. Without it, tokens can still be validated during tool execution, but MCP clients may not know how to start OAuth automatically.

`configureJwt()` requires `audience` or `resourceIdentifier`: the MCP spec requires the server to reject tokens that weren't issued for it. Use the value your authorization server puts in `aud` for this server, usually its `resourceServerUrl`.

## Protected MCP Server With Cognito

Use `configureCognito()` when Cognito is the token issuer.

```typescript
McpAuthModule.configureCognito({
  region: 'us-east-2',
  userPoolId: 'us-east-2_example',
  clientId: 'cognito-app-client-id',
  resourceServerUrl: 'https://api.example.com/mcp',
});

McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authStrategy: McpCognitoAuthStrategy,
  requireBearerAuth: true,
});
```

If the MCP endpoint is `/api/internal/mcp`, set `resourceServerUrl: 'https://api.example.com/api/internal/mcp'` and `route: 'internal/mcp'`.

## Embedded OAuth Authorization Server Only (deprecated)

Use this shape when the app acts as the authorization server but does not serve MCP tools itself.

```typescript
McpOAuthModule.configure({
  provider: MyOAuthProvider,
  issuerUrl: 'https://auth.example.com',
  baseUrl: 'https://auth.example.com',
  resourceServerUrl: 'https://api.example.com/mcp',
});
```

This exposes authorization-server endpoints such as `/.well-known/oauth-authorization-server`, `/authorize`, `/token`, `/register`, and `/revoke`. It does not protect any MCP route by itself.

If this module is mounted in an app with `app.setGlobalPrefix('api')`, the public OAuth endpoints are also prefixed unless you exclude them in your Nest bootstrap. In that case, set `baseUrl` to the public prefixed base such as `https://auth.example.com/api`.

## Embedded OAuth Server Plus Protected MCP Route (deprecated)

Use this shape when one Nest app issues tokens and serves protected MCP tools.

```typescript
@Module({
  imports: [
    McpOAuthModule.configure({
      provider: MyOAuthProvider,
      issuerUrl: 'https://auth.example.com',
      baseUrl: 'https://auth.example.com',
      resourceServerUrl: 'https://api.example.com/mcp',
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

Keep `issuerUrl`, OAuth `baseUrl`, and MCP `resourceServerUrl` distinct:

| Field               | Means                                                                     |
| ------------------- | ------------------------------------------------------------------------- |
| `issuerUrl`         | OAuth issuer identifier advertised in auth-server metadata and JWT `iss`. |
| `baseUrl`           | Public base URL where OAuth endpoints are reachable.                      |
| `resourceServerUrl` | Public MCP resource URL that access tokens protect.                       |

`McpOAuthModule` and `McpAuthModule` can both serve `/.well-known/oauth-protected-resource`; `serveProtectedResourceMetadata: false` leaves it to `McpAuthModule`.

## Stdio Servers

Use `McpStdioModule.registerAndServeStdio()` when the MCP client launches your server as a local subprocess. Stdio does not use HTTP routes, `resourceServerUrl`, CORS, or HTTP bearer challenges. You can still use the registry, decorators, guards, and auth strategy enrichment if your stdio integration supplies auth context.

stdout carries the protocol, so the module sends Nest's logs to stderr. If you pass a `logger` to `NestFactory`, make it `McpStderrLogger`, and never write to stdout yourself.

## Shared Tool Libraries

For DRY multi-app usage, put decorated MCP adapters in a shared Nest module such as `libs/mcp/billing` or `libs/mcp/patient-search`. Then import that module from a standalone MCP app, a bolted-on existing HTTP app, or a stdio app. Keep pure business logic in domain services and use MCP adapter methods for MCP-specific formatting, progress reporting, cancellation, and auth checks.

## Common Mistakes

- Using `McpJwtAuthStrategy` or `McpCognitoAuthStrategy` without `requireBearerAuth` and expecting automatic OAuth challenges.
- Installing `@onivoro/server-mcp-oauth` and expecting the MCP route to become protected automatically.
- Setting `resourceServerUrl` to the auth server URL instead of the public MCP endpoint.
- Forgetting to include a Nest global prefix or reverse-proxy base path in `resourceServerUrl`.
- Using `McpMemoryClientsStore` in production and expecting registered clients to survive restart.
- Importing both `McpOAuthModule` and `McpAuthModule` without `serveProtectedResourceMetadata: false` on `McpOAuthModule`.
- Throwing plain `Error`s with messages meant for the model. With `exposeErrorMessages: false` (the default from the next major release), only `McpToolError` messages and validation errors reach the client; everything else becomes `Internal error`.
- Calling a browser-based client from another origin without listing it in `allowedOrigins`.
- Putting MCP protocol concerns directly into reusable business services instead of using thin MCP adapter providers.
