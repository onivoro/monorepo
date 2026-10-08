import { Injectable, Logger, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { McpOAuthModule } from './mcp-oauth.module';
import { McpMemoryClientsStore } from './mcp-memory-clients-store';

const routerCalls: Array<{ method: string; url: string }> = [];
const handledPaths = new Set([
  '/authorize',
  '/token',
  '/register',
  '/revoke',
  '/.well-known/oauth-authorization-server',
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-protected-resource/mcp',
]);

jest.mock('@modelcontextprotocol/sdk/server/auth/router.js', () => ({
  mcpAuthRouter: jest
    .fn()
    .mockImplementation(() => (req: any, res: any, next: () => void) => {
      routerCalls.push({ method: req.method, url: req.url });
      if (handledPaths.has(req.url)) {
        res.status(200).json({ method: req.method, url: req.url });
        return;
      }
      next();
    }),
}));

const provider = {
  clientsStore: { getClient: jest.fn() },
  authorize: jest.fn(),
  challengeForAuthorizationCode: jest.fn(),
  exchangeAuthorizationCode: jest.fn(),
  exchangeRefreshToken: jest.fn(),
  verifyAccessToken: jest.fn(),
};

describe('McpOAuthModule routing', () => {
  let app: any;
  let baseUrl: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        McpOAuthModule.configure({
          provider: provider as any,
          issuerUrl: 'https://auth.example.com',
          resourceServerUrl: 'https://api.example.com/mcp',
        }),
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app?.close();
  });

  beforeEach(() => {
    routerCalls.length = 0;
  });

  it.each([
    ['GET', '/authorize'],
    ['POST', '/authorize'],
    ['POST', '/token'],
    ['POST', '/register'],
    ['POST', '/revoke'],
    ['GET', '/.well-known/oauth-authorization-server'],
    ['OPTIONS', '/.well-known/oauth-authorization-server'],
    ['GET', '/.well-known/oauth-protected-resource'],
    ['OPTIONS', '/.well-known/oauth-protected-resource'],
    ['GET', '/.well-known/oauth-protected-resource/mcp'],
    ['OPTIONS', '/.well-known/oauth-protected-resource/mcp'],
  ])(
    'dispatches %s %s to the SDK router with the original URL',
    async (method, path) => {
      const response = await fetch(`${baseUrl}${path}`, { method });

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ method, url: path });
      expect(routerCalls).toEqual([{ method, url: path }]);
    },
  );

  it('preserves the query string when dispatching', async () => {
    const response = await fetch(
      `${baseUrl}/authorize?client_id=abc&state=xyz`,
    );

    expect(response.status).toBe(404);
    expect(routerCalls).toEqual([
      { method: 'GET', url: '/authorize?client_id=abc&state=xyz' },
    ]);
  });

  it('responds 404 when the SDK router falls through without responding', async () => {
    const response = await fetch(
      `${baseUrl}/.well-known/oauth-protected-resource/other`,
    );

    expect(response.status).toBe(404);
    expect(routerCalls).toEqual([
      { method: 'GET', url: '/.well-known/oauth-protected-resource/other' },
    ]);
  });
});

describe('McpOAuthModule in-memory clients store warning', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    warnSpy.mockRestore();
  });

  @Injectable()
  class MemoryBackedProvider {
    constructor(readonly clientsStore: McpMemoryClientsStore) {}
    authorize = jest.fn();
    challengeForAuthorizationCode = jest.fn();
    exchangeAuthorizationCode = jest.fn();
    exchangeRefreshToken = jest.fn();
    verifyAccessToken = jest.fn();
  }

  function memoryStoreWarnings() {
    return warnSpy.mock.calls.filter(([message]) =>
      String(message).startsWith('McpMemoryClientsStore is active.'),
    );
  }

  async function initWith(oauthProvider: any) {
    @Module({
      imports: [
        McpOAuthModule.configure({
          provider: oauthProvider,
          issuerUrl: 'https://auth.example.com',
        }),
      ],
    })
    class TestAppModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [TestAppModule],
    }).compile();
    await moduleRef.init();
    await moduleRef.close();
  }

  it('warns outside of tests when the provider uses the module McpMemoryClientsStore', async () => {
    process.env.NODE_ENV = 'production';

    await initWith(MemoryBackedProvider);

    expect(memoryStoreWarnings()).toHaveLength(1);
  });

  it('does not warn when NODE_ENV is test', async () => {
    process.env.NODE_ENV = 'test';

    await initWith(MemoryBackedProvider);

    expect(memoryStoreWarnings()).toHaveLength(0);
  });

  it('does not warn when the provider uses a different clients store', async () => {
    process.env.NODE_ENV = 'production';

    await initWith(provider);

    expect(memoryStoreWarnings()).toHaveLength(0);
  });
});

describe('McpOAuthModule URL validation', () => {
  it.each([
    ['issuerUrl', { issuerUrl: 'mailto:admin@example.com' }],
    ['baseUrl', { baseUrl: '/relative' }],
    ['serviceDocumentationUrl', { serviceDocumentationUrl: 'docs' }],
  ])('rejects a non-absolute %s', (field, override) => {
    expect(() =>
      McpOAuthModule.configure({
        provider: provider as any,
        issuerUrl: 'https://auth.example.com',
        ...override,
      }),
    ).toThrow(`McpOAuthModule ${field} must be a valid absolute URL`);
  });

  it('rejects an invalid URL returned by a configureAsync factory', async () => {
    await expect(
      Test.createTestingModule({
        imports: [
          McpOAuthModule.registerAsync({
            useFactory: async () => ({
              provider: provider as any,
              issuerUrl: 'nope',
            }),
          }),
        ],
      }).compile(),
    ).rejects.toThrow(/issuerUrl must be a valid absolute URL/);
  });
});

describe('McpOAuthModule SDK router options', () => {
  it('forwards handler pass-through options and URL fields to mcpAuthRouter', async () => {
    const { mcpAuthRouter } = jest.requireMock(
      '@modelcontextprotocol/sdk/server/auth/router.js',
    );
    mcpAuthRouter.mockClear();

    const options = {
      authorizationOptions: { rateLimit: false },
      tokenOptions: { rateLimit: { max: 5 } },
      clientRegistrationOptions: { clientSecretExpirySeconds: 60 },
      revocationOptions: { rateLimit: false },
    };

    const moduleRef = await Test.createTestingModule({
      imports: [
        McpOAuthModule.configure({
          provider: provider as any,
          issuerUrl: 'https://auth.example.com',
          baseUrl: 'https://auth.example.com/oauth',
          serviceDocumentationUrl: 'https://docs.example.com',
          ...options,
        }),
      ],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.init();
    await app.close();

    expect(mcpAuthRouter).toHaveBeenCalledWith({
      provider,
      issuerUrl: new URL('https://auth.example.com'),
      baseUrl: new URL('https://auth.example.com/oauth'),
      serviceDocumentationUrl: new URL('https://docs.example.com'),
      ...options,
    });
  });
});
