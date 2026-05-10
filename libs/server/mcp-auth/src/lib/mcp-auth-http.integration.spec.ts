import { Module } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { McpHttpModule } from '@onivoro/server-mcp';
import { McpAuthModule } from './mcp-auth.module';
import { McpJwtAuthStrategy } from './mcp-jwt-auth-strategy';

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(),
  })),
}));

describe('McpAuthModule + McpHttpModule integration', () => {
  async function startApp(
    metadataMode: 'root' | 'path' | 'both' = 'both',
    requireBearerAuth: boolean | { requiredScopes?: string[]; resourceMetadataUrl?: string } = true,
    routePrefix?: string,
  ) {
    @Module({
      imports: [
        McpAuthModule.configureJwt({
          jwksUri: 'https://auth.example.com/.well-known/jwks.json',
          issuer: 'https://auth.example.com',
          resourceServerUrl: routePrefix
            ? `http://127.0.0.1/${routePrefix.replace(/^\/+|\/+$/g, '')}/mcp`
            : 'http://127.0.0.1/mcp',
          protectedResourceMetadataMode: metadataMode,
        }),
        McpHttpModule.registerAndServeHttp({
          metadata: { name: 'test', version: '1.0.0' },
          routePrefix,
          authStrategy: McpJwtAuthStrategy,
          requireBearerAuth,
        }),
      ],
    })
    class TestAppModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    return { app, baseUrl };
  }

  async function stopApp(app: INestApplication) {
    await app.close();
  }

  it('should challenge unauthenticated MCP requests with the path-derived PRM URL by default', async () => {
    const { app, baseUrl } = await startApp('both', true, 'api/v1');

    try {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });

      expect(response.status).toBe(401);
      const header = response.headers.get('www-authenticate') ?? '';
      expect(header).toContain(
        `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource/api/v1/mcp"`,
      );
    } finally {
      await stopApp(app);
    }
  });

  it('should serve both root and path-derived PRM routes by default', async () => {
    const { app, baseUrl } = await startApp('both', true, 'api/v1');

    try {
      const rootResponse = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
      expect(rootResponse.status).toBe(200);
      expect(await rootResponse.json()).toEqual(expect.objectContaining({
        resource: 'http://127.0.0.1/api/v1/mcp',
        authorization_servers: ['https://auth.example.com'],
      }));

      const pathResponse = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/api/v1/mcp`);
      expect(pathResponse.status).toBe(200);
      expect(await pathResponse.json()).toEqual(expect.objectContaining({
        resource: 'http://127.0.0.1/api/v1/mcp',
        authorization_servers: ['https://auth.example.com'],
      }));
    } finally {
      await stopApp(app);
    }
  });

  it('should disable the root PRM route when configured for path-only metadata', async () => {
    const { app, baseUrl } = await startApp('path', true, 'api/v1');

    try {
      const rootResponse = await fetch(`${baseUrl}/.well-known/oauth-protected-resource`);
      expect(rootResponse.status).toBe(404);

      const pathResponse = await fetch(`${baseUrl}/.well-known/oauth-protected-resource/api/v1/mcp`);
      expect(pathResponse.status).toBe(200);
    } finally {
      await stopApp(app);
    }
  });

  it('should honor an explicit root PRM challenge URL override', async () => {
    const { app, baseUrl } = await startApp('both', {
      resourceMetadataUrl: '/.well-known/oauth-protected-resource',
    }, 'api/v1');

    try {
      const response = await fetch(`${baseUrl}/api/v1/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });

      expect(response.status).toBe(401);
      const header = response.headers.get('www-authenticate') ?? '';
      expect(header).toContain(
        `resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
      );
    } finally {
      await stopApp(app);
    }
  });
});
