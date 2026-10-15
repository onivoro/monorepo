import { Injectable, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import type {
  AuthInfo,
  OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import { OAuthError, OAuthErrorCode } from '@modelcontextprotocol/server';
import type { AddressInfo } from 'net';
import * as http from 'http';
import { McpHttpModule } from './mcp-http.module';
import { McpTool } from './mcp-tool.decorator';
import { McpGuard } from './mcp-guard.decorator';
import { McpScopeGuard } from './mcp-scope-guard';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import type { McpModuleConfig } from './mcp-module-config';

// Per-caller tool visibility over HTTP, with the MCP SDK's own client in both protocol eras,
// against stateless and stateful servers. Two bearer tokens: one with the `admin` scope, one
// (an agent's) without.

const TOKENS: Record<string, string[]> = {
  'admin-token': ['admin'],
  'agent-token': ['agent'],
  'beta-token': ['agent'],
};

@Injectable()
class TokenAuthStrategy implements McpAuthStrategy, OAuthTokenVerifier {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const scopes = TOKENS[token];
    if (!scopes) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Unknown token');
    }
    // One client for every token, so a stepped-up token is the same session principal.
    return {
      token,
      clientId: 'visibility-client',
      extra: { beta: token === 'beta-token' },
      scopes,
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  async resolveAuth(authInfo?: McpAuthInfo) {
    return authInfo;
  }
}

const adminCalls: string[] = [];

@Injectable()
class VisibilityToolService {
  @McpTool({ name: 'public', description: 'Anyone' })
  async public() {
    return 'public';
  }

  @McpTool({ name: 'admin-only', description: 'Admins only' })
  @McpGuard(McpScopeGuard, { scopes: ['admin'] })
  async adminOnly() {
    adminCalls.push('admin-only');
    return 'admin';
  }
}

async function startApp(config: Partial<McpModuleConfig>) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      McpHttpModule.registerAndServeHttp({
        metadata: { name: 'visibility-e2e', version: '1.0.0' },
        exposeErrorMessages: true,
        authStrategy: TokenAuthStrategy,
        requireBearerAuth: true,
        ...config,
      }),
    ],
    providers: [VisibilityToolService, TokenAuthStrategy],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    registry: moduleRef.get(McpToolRegistry),
    url: new URL(`http://localhost:${port}/mcp`),
  };
}

async function connect(url: URL, mode: 'auto' | 'legacy', token: string) {
  const client = new Client(
    { name: 'visibility-client', version: '1.0.0' },
    { versionNegotiation: { mode } },
  );
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

async function toolNames(client: Client): Promise<string[]> {
  return (await client.listTools()).tools.map((tool) => tool.name).sort();
}

describe('Per-caller tool visibility over HTTP', () => {
  beforeEach(() => {
    adminCalls.length = 0;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  describe.each([
    ['stateless', {}],
    ['stateful', { session: {} }],
  ] as Array<[string, Partial<McpModuleConfig>]>)(
    "toolVisibility: 'authorized', %s server",
    (_name, config) => {
      let app: any;
      let url: URL;

      beforeAll(async () => {
        ({ app, url } = await startApp({
          ...config,
          toolVisibility: 'authorized',
        }));
      });

      afterAll(async () => {
        await app?.close();
      });

      describe.each([
        ['2026-07-28', 'auto'],
        ['2025-era', 'legacy'],
      ] as const)('%s client', (_era, mode) => {
        it('hides the admin tool from an agent token', async () => {
          const client = await connect(url, mode, 'agent-token');
          expect(await toolNames(client)).toEqual(['public']);
          await client.close();
        });

        it('lists the admin tool to an admin token', async () => {
          const client = await connect(url, mode, 'admin-token');
          expect(await toolNames(client)).toEqual(['admin-only', 'public']);
          const result: any = await client.callTool({
            name: 'admin-only',
            arguments: {},
          });
          expect(result.content[0].text).toBe('admin');
          await client.close();
        });

        it('refuses the admin tool to an agent token that calls it anyway (403 insufficient_scope)', async () => {
          const client = await connect(url, mode, 'agent-token');
          await expect(
            client.callTool({ name: 'admin-only', arguments: {} }),
          ).rejects.toThrow(/Insufficient scope/);
          expect(adminCalls).toEqual([]);
          await client.close();
        });
      });
    },
  );

  describe("default toolVisibility ('all')", () => {
    let app: any;
    let url: URL;

    beforeAll(async () => {
      ({ app, url } = await startApp({ session: {} }));
    });

    afterAll(async () => {
      await app?.close();
    });

    it.each(['auto', 'legacy'] as const)(
      'lists every tool to an agent token negotiating %s, and still refuses the call',
      async (mode) => {
        const client = await connect(url, mode, 'agent-token');
        expect(await toolNames(client)).toEqual(['admin-only', 'public']);
        await expect(
          client.callTool({ name: 'admin-only', arguments: {} }),
        ).rejects.toThrow(/Insufficient scope/);
        expect(adminCalls).toEqual([]);
        await client.close();
      },
    );
  });

  describe.each([
    ['stateless', {}],
    ['stateful', { session: {} }],
  ] as Array<[string, Partial<McpModuleConfig>]>)(
    'toolFilter, %s server',
    (_name, config) => {
      let app: any;
      let url: URL;

      beforeAll(async () => {
        ({ app, url } = await startApp({
          ...config,
          toolVisibility: 'authorized',
          // Applied on top of the scope rule: it hides `public` from admins, so each token
          // sees one tool.
          toolFilter: (tool, authInfo) =>
            !(tool.name === 'public' && authInfo?.scopes.includes('admin')),
        }));
      });

      afterAll(async () => {
        await app?.close();
      });

      it.each(['auto', 'legacy'] as const)(
        'applies on top of the scope rule for a client negotiating %s',
        async (mode) => {
          const admin = await connect(url, mode, 'admin-token');
          const agent = await connect(url, mode, 'agent-token');
          expect(await toolNames(admin)).toEqual(['admin-only']);
          expect(await toolNames(agent)).toEqual(['public']);
          await admin.close();
          await agent.close();
        },
      );

      it.each(['auto', 'legacy'] as const)(
        'answers a call to a filtered-out tool as for a tool that does not exist (%s)',
        async (mode) => {
          const admin = await connect(url, mode, 'admin-token');
          const call = admin.callTool({ name: 'public', arguments: {} });
          await expect(call).rejects.toThrow(/Tool public not found/);
          await expect(
            admin.callTool({ name: 'no-such-tool', arguments: {} }),
          ).rejects.toThrow(/Tool no-such-tool not found/);
          await admin.close();
        },
      );
    },
  );

  describe('stateful sessions, 2025-era clients, with registry changes', () => {
    let app: any;
    let url: URL;
    let registry: McpToolRegistry;

    beforeEach(async () => {
      ({ app, url, registry } = await startApp({
        session: {},
        toolVisibility: 'authorized',
      }));
    });

    afterEach(async () => {
      await app?.close();
    });

    /**
     * Connects a 2025-era client, and waits for the standalone SSE stream it opens after
     * initializing, which is where list-changed notifications go.
     */
    async function connectSession(token: string) {
      const client = await connect(url, 'legacy', token);
      await client.listTools();
      await sleep(50);
      return client;
    }

    it('keeps a disabled tool hidden for everyone, and shows it again only to authorized callers', async () => {
      const admin = await connectSession('admin-token');
      const agent = await connectSession('agent-token');
      const adminChanges = onToolsChanged(admin);
      const agentChanges = onToolsChanged(agent);

      registry.setToolEnabled('admin-only', false);
      await until(() => adminChanges() === 1 && agentChanges() === 1);
      expect(await toolNames(admin)).toEqual(['public']);
      expect(await toolNames(agent)).toEqual(['public']);

      registry.setToolEnabled('admin-only', true);
      // Every session hears that the list changed; each one's next list is its own.
      await until(() => adminChanges() === 2 && agentChanges() === 2);
      expect(await toolNames(admin)).toEqual(['admin-only', 'public']);
      expect(await toolNames(agent)).toEqual(['public']);

      await admin.close();
      await agent.close();
    });

    it('shows a scoped tool registered later only to callers who may see it', async () => {
      const admin = await connectSession('admin-token');
      const agent = await connectSession('agent-token');
      const adminChanges = onToolsChanged(admin);
      const agentChanges = onToolsChanged(agent);

      registry.registerTool(
        { name: 'late-public', description: 'Anyone, later' },
        async () => 'late',
      );
      registry.registerTool(
        { name: 'late-admin', description: 'Admins, later' },
        async () => 'late admin',
        [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
      );

      await until(() => adminChanges() === 2 && agentChanges() === 2);
      expect(await toolNames(admin)).toEqual([
        'admin-only',
        'late-admin',
        'late-public',
        'public',
      ]);
      expect(await toolNames(agent)).toEqual(['late-public', 'public']);

      await admin.close();
      await agent.close();
    });
  });

  describe('while a request is still being decided', () => {
    /**
     * A `toolFilter` that blocks every call made before `release()`, so a test can act while
     * a request's visibility is being decided.
     */
    function blockingFilter() {
      let blocking = true;
      let entered!: () => void;
      let release!: () => void;
      const enteredPromise = new Promise<void>(
        (resolve) => (entered = resolve),
      );
      const released = new Promise<void>((resolve) => (release = resolve));
      return {
        filter: async () => {
          if (blocking) {
            entered();
            await released;
          }
          return true;
        },
        entered: enteredPromise,
        release: () => {
          blocking = false;
          release();
        },
      };
    }

    function wiredServers(registry: McpToolRegistry) {
      return {
        toolEnabledDelegates: (registry as any).toolEnabledDelegates.size,
        changeListeners: (registry as any).changeListeners.length,
      };
    }

    let app: any;

    afterEach(async () => {
      await app?.close();
      app = undefined;
    });

    it('leaves no server wired to the registry for a stateless request whose client went away', async () => {
      const blocker = blockingFilter();
      let registry: McpToolRegistry;
      ({ app, registry } = await startApp({
        toolVisibility: 'authorized',
        toolFilter: blocker.filter,
      }));
      const { port } = app.getHttpServer().address() as AddressInfo;
      const before = wiredServers(registry);

      const req = http.request({
        host: '127.0.0.1',
        port,
        path: '/mcp',
        method: 'POST',
        headers: {
          host: `localhost:${port}`,
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: 'Bearer admin-token',
          'mcp-protocol-version': '2025-06-18',
        },
      });
      req.on('error', () => undefined);
      req.end(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/list',
          params: {},
        }),
      );

      await blocker.entered;
      req.destroy();
      await sleep(50);
      blocker.release();
      await sleep(50);

      expect(wiredServers(registry)).toEqual(before);
    });

    it('lists a tool registered while a request was being decided on a stateful session', async () => {
      const blocker = blockingFilter();
      let registry: McpToolRegistry;
      let url: URL;
      ({ app, registry, url } = await startApp({
        session: {},
        toolVisibility: 'authorized',
        toolFilter: blocker.filter,
      }));
      const client = await connect(url, 'legacy', 'admin-token');

      const listing = toolNames(client);
      await blocker.entered;
      registry.registerTool(
        { name: 'meanwhile', description: 'Registered while deciding' },
        async () => 'meanwhile',
        [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
      );
      blocker.release();
      await listing;

      expect(await toolNames(client)).toEqual([
        'admin-only',
        'meanwhile',
        'public',
      ]);
      await client.close();
    });
  });

  describe('a stateful session whose requests carry different tokens', () => {
    let app: any;
    let url: URL;
    let registry: McpToolRegistry;
    const extraTokens: string[] = [];

    beforeEach(async () => {
      ({ app, url, registry } = await startApp({
        session: {},
        toolVisibility: 'authorized',
        // `beta-*` tools only for tokens marked beta.
        toolFilter: (tool, authInfo) =>
          !tool.name.startsWith('beta-') || authInfo?.extra?.['beta'] === true,
      }));
      registry.registerTool(
        { name: 'beta-x', description: 'Beta only' },
        async () => 'beta',
      );
    });

    afterEach(async () => {
      for (const token of extraTokens.splice(0)) delete TOKENS[token];
      await app?.close();
    });

    /** A 2025-era client whose bearer token can change between requests. */
    async function connectWithToken(initialToken: string) {
      const auth = { token: initialToken };
      const client = new Client(
        { name: 'token-client', version: '1.0.0' },
        { versionNegotiation: { mode: 'legacy' } },
      );
      const transport = new StreamableHTTPClientTransport(url, {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          headers.set('Authorization', `Bearer ${auth.token}`);
          return fetch(input, { ...init, headers });
        },
      });
      await client.connect(transport);
      return { client, transport, auth };
    }

    it('enforces toolFilter on each request by its own token, whatever the session saw before', async () => {
      const { client, transport, auth } = await connectWithToken('agent-token');
      const sessionId = transport.sessionId;
      expect(await toolNames(client)).toEqual(['public']);

      auth.token = 'beta-token';
      expect(await toolNames(client)).toEqual(['beta-x', 'public']);
      const result: any = await client.callTool({
        name: 'beta-x',
        arguments: {},
      });
      expect(result.content[0].text).toBe('beta');

      auth.token = 'agent-token';
      await expect(
        client.callTool({ name: 'beta-x', arguments: {} }),
      ).rejects.toThrow(/Tool beta-x not found/);
      expect(await toolNames(client)).toEqual(['public']);
      expect(transport.sessionId).toBe(sessionId);
      await client.close();
    });

    it('serves each of many rotating tokens, and the opening token again, by its own rights', async () => {
      const { client, auth } = await connectWithToken('agent-token');
      for (let i = 0; i < 20; i++) {
        const token = `rotated-${i}`;
        TOKENS[token] = ['admin'];
        extraTokens.push(token);
        auth.token = token;
        expect(await toolNames(client)).toEqual(['admin-only', 'public']);
      }

      auth.token = 'agent-token';
      expect(await toolNames(client)).toEqual(['public']);

      auth.token = 'rotated-19';
      expect(await toolNames(client)).toEqual(['admin-only', 'public']);
      const result: any = await client.callTool({
        name: 'admin-only',
        arguments: {},
      });
      expect(result.content[0].text).toBe('admin');
      await client.close();
    });

    it('runs a tool after the client steps up on the same session, and still hides it from the old token', async () => {
      const { client, transport, auth } = await connectWithToken('agent-token');
      const sessionId = transport.sessionId;

      await expect(
        client.callTool({ name: 'admin-only', arguments: {} }),
      ).rejects.toThrow(/Insufficient scope/);

      auth.token = 'admin-token';
      const result: any = await client.callTool({
        name: 'admin-only',
        arguments: {},
      });
      expect(result.content[0].text).toBe('admin');
      expect(adminCalls).toEqual(['admin-only']);
      expect(await toolNames(client)).toEqual(['admin-only', 'public']);
      expect(transport.sessionId).toBe(sessionId);

      auth.token = 'agent-token';
      expect(await toolNames(client)).toEqual(['public']);
      await client.close();
    });
  });
});

function onToolsChanged(client: Client): () => number {
  let count = 0;
  client.setNotificationHandler('notifications/tools/list_changed', () => {
    count++;
  });
  return () => count;
}

async function until(condition: () => boolean) {
  for (let i = 0; i < 100 && !condition(); i++) await sleep(10);
  expect(condition()).toBe(true);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
