import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { McpHttpModule } from '@onivoro/server-mcp';
import { McpAuthModule, McpJwtAuthStrategy } from '@onivoro/server-mcp-auth';
import { McpOAuthModule } from './mcp-oauth.module';

jest.mock('jwks-rsa', () => ({
  JwksClient: jest.fn().mockImplementation(() => ({
    getSigningKey: jest.fn(),
  })),
}));

jest.mock('@modelcontextprotocol/sdk/server/auth/router.js', () => ({
  mcpAuthRouter: jest.fn().mockImplementation((config: any) => {
    return (req: any, res: any, next: any) => {
      const path = req.originalUrl || req.url;
      if (req.method === 'GET' && path === '/.well-known/oauth-authorization-server') {
        res.json({ issuer: config.issuerUrl.href });
        return;
      }
      if (req.method === 'GET' && path === '/.well-known/oauth-protected-resource') {
        res.json({
          resource: config.resourceServerUrl?.href ?? config.baseUrl?.href ?? config.issuerUrl.href,
        });
        return;
      }
      if (req.method === 'GET' && path.startsWith('/.well-known/oauth-protected-resource/')) {
        res.json({
          resource: config.resourceServerUrl?.href ?? config.baseUrl?.href ?? config.issuerUrl.href,
        });
        return;
      }
      if (req.method === 'GET' && path === '/authorize') {
        res.json({ ok: true });
        return;
      }
      if (req.method === 'POST' && path === '/token') {
        res.json({ access_token: 'token', token_type: 'Bearer' });
        return;
      }
      if (req.method === 'POST' && path === '/register') {
        res.status(201).json({ client_id: 'client-1' });
        return;
      }
      if (req.method === 'POST' && path === '/revoke') {
        res.status(200).json({ revoked: true });
        return;
      }

      next();
    };
  }),
}));

describe('McpOAuthModule integration', () => {
  const provider = {
    clientsStore: { getClient: jest.fn() },
    authorize: jest.fn(),
    challengeForAuthorizationCode: jest.fn(),
    exchangeAuthorizationCode: jest.fn(),
    exchangeRefreshToken: jest.fn(),
    verifyAccessToken: jest.fn(),
  };

  async function startApp(moduleClass: any) {
    const moduleRef = await Test.createTestingModule({
      imports: [moduleClass],
    }).compile();

    const app = moduleRef.createNestApplication();
    await app.listen(0);

    const server = app.getHttpServer();
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;

    return { app, baseUrl };
  }

  it('should mount standard OAuth endpoints', async () => {
    @Module({
      imports: [
        McpOAuthModule.register({
          provider: provider as any,
          issuerUrl: 'https://auth.example.com',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
      ],
    })
    class TestAppModule {}

    const { app, baseUrl } = await startApp(TestAppModule);

    try {
      expect((await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/.well-known/oauth-protected-resource`)).status).toBe(200);
      expect((await fetch(`${baseUrl}/authorize`)).status).toBe(200);
    } finally {
      await app.close();
    }
  });

  it('should not protect /mcp by itself when composed only with McpHttpModule', async () => {
    @Module({
      imports: [
        McpOAuthModule.register({
          provider: provider as any,
          issuerUrl: 'https://auth.example.com',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
        McpHttpModule.registerAndServeHttp({
          metadata: { name: 'test', version: '1.0.0' },
        }),
      ],
    })
    class TestAppModule {}

    const { app, baseUrl } = await startApp(TestAppModule);

    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });

      expect(response.status).not.toBe(401);
    } finally {
      await app.close();
    }
  });

  it('should compose with McpAuthModule and McpHttpModule to protect /mcp', async () => {
    @Module({
      imports: [
        McpOAuthModule.register({
          provider: provider as any,
          issuerUrl: 'https://auth.example.com',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
        McpAuthModule.register({
          jwksUri: 'https://auth.example.com/.well-known/jwks.json',
          issuer: 'https://auth.example.com',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
        McpHttpModule.registerAndServeHttp({
          metadata: { name: 'test', version: '1.0.0' },
          authStrategy: McpJwtAuthStrategy,
          requireBearerAuth: true,
        }),
      ],
    })
    class TestAppModule {}

    const { app, baseUrl } = await startApp(TestAppModule);

    try {
      const response = await fetch(`${baseUrl}/mcp`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
      });

      expect(response.status).toBe(401);
      expect(response.headers.get('www-authenticate')).toContain(
        `${baseUrl}/.well-known/oauth-protected-resource/mcp`,
      );
    } finally {
      await app.close();
    }
  });

  it('should support class-based providers in registerAsync()', async () => {
    @Injectable()
    class AsyncOAuthProvider {
      clientsStore = { getClient: jest.fn() };
      authorize = jest.fn();
      challengeForAuthorizationCode = jest.fn();
      exchangeAuthorizationCode = jest.fn();
      exchangeRefreshToken = jest.fn();
      verifyAccessToken = jest.fn();
    }

    @Module({
      providers: [AsyncOAuthProvider],
      exports: [AsyncOAuthProvider],
      imports: [
        McpOAuthModule.registerAsync({
          useFactory: () => ({
            provider: AsyncOAuthProvider,
            issuerUrl: 'https://auth.example.com',
            resourceServerUrl: 'https://api.example.com/mcp',
          }),
        }),
      ],
    })
    class TestAppModule {}

    const { app, baseUrl } = await startApp(TestAppModule);

    try {
      expect((await fetch(`${baseUrl}/.well-known/oauth-authorization-server`)).status).toBe(200);
    } finally {
      await app.close();
    }
  });
});
