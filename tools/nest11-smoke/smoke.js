// Serves the protected-resource metadata routes of the built MCP libraries on
// Nest 11 and checks what each path answers. The repo's own tests run on
// Nest 10. Run from the repo root with `npm run smoke:nest11`.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const {
  McpHttpModule,
  PROTECTED_RESOURCE_WILDCARD,
} = require('@onivoro/server-mcp');
const {
  McpAuthModule,
  McpJwtAuthStrategy,
} = require('@onivoro/server-mcp-auth');
const { McpOAuthModule } = require('@onivoro/server-mcp-oauth');

const oauthProvider = {
  clientsStore: { getClient: async () => undefined },
  authorize: async () => undefined,
  challengeForAuthorizationCode: async () => '',
  exchangeAuthorizationCode: async () => {
    throw new Error('not used');
  },
  exchangeRefreshToken: async () => {
    throw new Error('not used');
  },
  verifyAccessToken: async () => {
    throw new Error('not used');
  },
};

let failures = 0;

async function withApp(name, imports, globalPrefix, checks) {
  class SmokeAppModule {}
  Module({ imports })(SmokeAppModule);
  const app = await NestFactory.create(SmokeAppModule, {
    logger: ['error', 'warn'],
  });
  if (globalPrefix) {
    app.setGlobalPrefix(globalPrefix);
  }
  await app.listen(0, '127.0.0.1');
  const baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;

  try {
    for (const [method, path, expectedStatus, expectedResource] of checks) {
      const label = `${name}: ${method} ${path}`;
      try {
        const response = await fetch(`${baseUrl}${path}`, { method });
        assert.equal(response.status, expectedStatus, 'status');
        if (expectedResource) {
          assert.equal((await response.json()).resource, expectedResource);
        }
        console.log(`  ok    ${label} -> ${response.status}`);
      } catch (error) {
        failures++;
        console.log(`  FAIL  ${label}: ${error.message}`);
      }
    }
  } finally {
    await app.close();
  }
}

function authImports(resourceServerUrl, route) {
  return [
    McpAuthModule.configureJwt({
      jwksUri: 'https://auth.example.com/.well-known/jwks.json',
      issuer: 'https://auth.example.com',
      resourceServerUrl,
    }),
    McpHttpModule.registerAndServeHttp({
      metadata: { name: 'smoke', version: '1.0.0' },
      route,
      authStrategy: McpJwtAuthStrategy,
      requireBearerAuth: true,
    }),
  ];
}

async function main() {
  const nestVersion = require('@nestjs/core/package.json').version;
  console.log(
    `@nestjs/core ${nestVersion}, route wildcard ${PROTECTED_RESOURCE_WILDCARD}`,
  );
  assert.equal(PROTECTED_RESOURCE_WILDCARD, '*resourcePath');

  const prm = '/.well-known/oauth-protected-resource';

  await withApp(
    'McpAuthModule',
    authImports('http://127.0.0.1/mcp', 'mcp'),
    undefined,
    [
      ['GET', `${prm}/mcp`, 200, 'http://127.0.0.1/mcp'],
      ['GET', `${prm}/mcp/`, 200, 'http://127.0.0.1/mcp'],
      ['GET', `${prm}/other`, 404],
      ['GET', `${prm}//mcp`, 404],
    ],
  );

  await withApp(
    'McpAuthModule behind a global prefix',
    authImports('http://127.0.0.1/api/internal/mcp', 'internal/mcp'),
    'api',
    [
      [
        'GET',
        `/api${prm}/api/internal/mcp`,
        200,
        'http://127.0.0.1/api/internal/mcp',
      ],
      ['GET', `/api${prm}/api/internal`, 404],
    ],
  );

  await withApp(
    'McpOAuthModule',
    [
      McpOAuthModule.register({
        provider: oauthProvider,
        issuerUrl: 'https://auth.example.com',
        resourceServerUrl: 'https://api.example.com/mcp',
      }),
    ],
    undefined,
    [
      ['GET', `${prm}/mcp`, 200, 'https://api.example.com/mcp'],
      ['OPTIONS', `${prm}/mcp`, 204],
    ],
  );

  if (failures) {
    console.log(`${failures} check(s) failed`);
    process.exit(1);
  }
  console.log('All checks passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
