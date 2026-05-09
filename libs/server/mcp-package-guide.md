# MCP Server Package Guide

This guide explains how the `@onivoro/server-mcp*` packages fit together.

## Choose a package set

| Goal | Packages | Notes |
|------|----------|-------|
| Plain MCP server | `@onivoro/server-mcp` | No auth required |
| Protected MCP server using an external OAuth/JWT provider | `@onivoro/server-mcp` + `@onivoro/server-mcp-auth` | Recommended for Cognito, Auth0, Entra, custom JWKS-backed auth |
| Embedded OAuth authorization server only | `@onivoro/server-mcp-oauth` | Publishes auth-server endpoints, but does not protect `/mcp` by itself |
| Embedded OAuth authorization server plus protected MCP route | `@onivoro/server-mcp` + `@onivoro/server-mcp-auth` + `@onivoro/server-mcp-oauth` | Full issue, discover, challenge, and validate flow |

## Canonical compositions

### Plain MCP server

```typescript
McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
})
```

### Protected MCP server with external JWT/OAuth

```typescript
McpAuthModule.register({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  issuer: 'https://auth.example.com',
  resourceServerUrl: 'https://api.example.com/mcp',
})

McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authStrategy: McpJwtAuthStrategy,
  requireBearerAuth: true,
})
```

### Embedded OAuth server only

```typescript
McpOAuthModule.register({
  provider: MyOAuthProvider,
  issuerUrl: 'https://auth.example.com',
  resourceServerUrl: 'https://api.example.com/mcp',
})
```

### Embedded OAuth server plus protected MCP route

```typescript
McpOAuthModule.register({
  provider: MyOAuthProvider,
  issuerUrl: 'https://auth.example.com',
  resourceServerUrl: 'https://api.example.com/mcp',
})

McpAuthModule.register({
  jwksUri: 'https://auth.example.com/.well-known/jwks.json',
  issuer: 'https://auth.example.com',
  resourceServerUrl: 'https://api.example.com/mcp',
})

McpHttpModule.registerAndServeHttp({
  metadata: { name: 'my-server', version: '1.0.0' },
  authStrategy: McpJwtAuthStrategy,
  requireBearerAuth: true,
})
```

## Responsibility boundaries

- `@onivoro/server-mcp` owns transport, discovery, registry wiring, session handling, and HTTP bearer challenges.
- `@onivoro/server-mcp-auth` owns resource-server JWT validation and Protected Resource Metadata.
- `@onivoro/server-mcp-oauth` owns authorization-server endpoints and discovery.

## Common mistakes

- Using `McpJwtAuthStrategy` without `requireBearerAuth` and expecting automatic OAuth challenges.
- Installing `@onivoro/server-mcp-oauth` and expecting `/mcp` to become protected automatically.
- Serving Protected Resource Metadata without setting `resourceServerUrl`.
- Using `McpMemoryClientsStore` in a long-lived environment and expecting registered clients to survive restart.
