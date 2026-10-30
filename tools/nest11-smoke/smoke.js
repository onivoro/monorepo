// Serves the protected-resource metadata routes of the built MCP libraries on
// Nest 11 and checks what each path answers, and that the OpenAPI document
// @nestjs/swagger 11 builds declares the wildcard's parameter. The repo's own
// tests run on Nest 10. Run from the repo root with `npm run smoke:nest11`.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { Module } = require('@nestjs/common');
const { NestFactory } = require('@nestjs/core');
const { DocumentBuilder, SwaggerModule } = require('@nestjs/swagger');
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

/**
 * Client generators reject a path that names `{resourcePath}` without a
 * parameter declaring it, which is what swagger builds for a handler that
 * does not declare the parameter or types it as a union.
 */
function checkOpenApi(name, app, expectedPath) {
  const label = `${name}: OpenAPI ${expectedPath}`;
  try {
    const { paths } = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().build(),
    );
    const operations = Object.entries(paths[expectedPath] ?? {});
    assert.ok(operations.length, `no operations at ${expectedPath}`);
    for (const [method, operation] of operations) {
      assert.ok(
        (operation.parameters ?? []).some(
          (_) => _.name === 'resourcePath' && _.in === 'path' && _.required,
        ),
        `${method.toUpperCase()} does not declare resourcePath`,
      );
    }
    console.log(
      `  ok    ${label} declares resourcePath on ${operations
        .map(([method]) => method.toUpperCase())
        .join(', ')}`,
    );
  } catch (error) {
    failures++;
    console.log(`  FAIL  ${label}: ${error.message}`);
  }
}

async function withApp(name, imports, globalPrefix, checks, openApiPath) {
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

  if (openApiPath) {
    checkOpenApi(name, app, openApiPath);
  }

  try {
    for (const [
      method,
      path,
      expectedStatus,
      expectedResource,
      init = {},
      expectedErrorCode,
    ] of checks) {
      const label = `${name}: ${method} ${path}${init.label ? ` (${init.label})` : ''}`;
      try {
        const response = await fetch(`${baseUrl}${path}`, {
          method,
          headers: init.headers,
          body: init.body,
        });
        assert.equal(response.status, expectedStatus, 'status');
        if (expectedResource) {
          assert.equal((await response.json()).resource, expectedResource);
        }
        if (expectedErrorCode !== undefined) {
          assert.equal((await response.json()).error.code, expectedErrorCode);
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
      audience: resourceServerUrl,
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
    `${prm}/{resourcePath}`,
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
    `/api${prm}/{resourcePath}`,
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
    `${prm}/{resourcePath}`,
  );

  // Express 5's JSON parser leaves req.body unset for a POST that isn't JSON, which the
  // module answers as a client error rather than a missing body parser.
  const accept = 'application/json, text/event-stream';
  await withApp(
    'McpHttpModule POST bodies',
    [
      McpHttpModule.registerAndServeHttp({
        metadata: { name: 'smoke', version: '1.0.0' },
      }),
    ],
    undefined,
    [
      [
        'POST',
        '/mcp',
        415,
        undefined,
        { label: 'no body', headers: { accept } },
        -32000,
      ],
      [
        'POST',
        '/mcp',
        415,
        undefined,
        {
          label: 'text/plain',
          headers: { accept, 'content-type': 'text/plain' },
          body: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
        },
        -32000,
      ],
      [
        'POST',
        '/mcp',
        400,
        undefined,
        {
          label: 'JSON, no body',
          headers: { accept, 'content-type': 'application/json' },
        },
        -32700,
      ],
      [
        'POST',
        '/mcp',
        200,
        undefined,
        {
          label: 'JSON ping',
          headers: {
            accept,
            'content-type': 'application/json',
          },
          body: '{"jsonrpc":"2.0","id":1,"method":"ping"}',
        },
      ],
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
