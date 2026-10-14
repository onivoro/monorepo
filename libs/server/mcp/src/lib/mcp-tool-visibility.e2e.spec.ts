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
import { McpHttpService } from './mcp-http.service';
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

  describe('toolFilter', () => {
    let app: any;
    let url: URL;

    beforeAll(async () => {
      ({ app, url } = await startApp({
        session: {},
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
  });

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
      await new Promise((resolve) => setTimeout(resolve, 50));
      return client;
    }

    function onToolsChanged(client: Client): () => number {
      let count = 0;
      client.setNotificationHandler('notifications/tools/list_changed', () => {
        count++;
      });
      return () => count;
    }

    async function until(condition: () => boolean) {
      for (let i = 0; i < 100 && !condition(); i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(condition()).toBe(true);
    }

    it('keeps a disabled tool hidden for everyone, and shows it again only to authorized callers', async () => {
      const admin = await connectSession('admin-token');
      const agent = await connectSession('agent-token');
      const adminChanges = onToolsChanged(admin);
      const agentChanges = onToolsChanged(agent);

      registry.setToolEnabled('admin-only', false);
      await until(() => adminChanges() === 1);
      expect(await toolNames(admin)).toEqual(['public']);
      expect(await toolNames(agent)).toEqual(['public']);

      registry.setToolEnabled('admin-only', true);
      await until(() => adminChanges() === 2);
      expect(await toolNames(admin)).toEqual(['admin-only', 'public']);
      expect(await toolNames(agent)).toEqual(['public']);
      // The agent's session never had the tool, so toggling it told the agent nothing.
      expect(agentChanges()).toBe(0);

      await admin.close();
      await agent.close();
    });

    it('shows a scoped tool registered later only to sessions that may see it', async () => {
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

      await until(() => adminChanges() === 2 && agentChanges() === 1);
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

  describe('while the visibility is still being decided', () => {
    /**
     * A `toolFilter` that blocks every call made before `release()`, so a test can act while
     * a server's visibility is being resolved.
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

    const sleep = (ms: number) =>
      new Promise((resolve) => setTimeout(resolve, ms));

    let app: any;

    afterEach(async () => {
      await app?.close();
      app = undefined;
    });

    const initialize = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-06-18',
        capabilities: {},
        clientInfo: { name: 'raw', version: '1.0.0' },
      },
    };

    it.each([
      ['a stateless 2025-era POST', {}, {}],
      ['a stateful initialize', { session: {} }, {}],
      [
        'a stateful initialize naming an unknown session',
        { session: {} },
        { 'mcp-session-id': 'gone' },
      ],
    ] as Array<[string, Partial<McpModuleConfig>, Record<string, string>]>)(
      'builds no server for %s whose client went away',
      async (_name, config, headers) => {
        const blocker = blockingFilter();
        let registry: McpToolRegistry;
        ({ app, registry } = await startApp({
          ...config,
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
            ...headers,
          },
        });
        req.on('error', () => undefined);
        req.end(JSON.stringify(initialize));

        await blocker.entered;
        req.destroy();
        await sleep(50);
        blocker.release();
        await sleep(50);

        expect(wiredServers(registry)).toEqual(before);
      },
    );

    it('wires a tool registered meanwhile onto a stateful session that may see it', async () => {
      const blocker = blockingFilter();
      let registry: McpToolRegistry;
      let url: URL;
      ({ app, registry, url } = await startApp({
        session: {},
        toolVisibility: 'authorized',
        toolFilter: blocker.filter,
      }));

      const connecting = connect(url, 'legacy', 'admin-token');
      await blocker.entered;
      registry.registerTool(
        { name: 'meanwhile', description: 'Registered while resolving' },
        async () => 'meanwhile',
        [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
      );
      blocker.release();
      const client = await connecting;

      let names: string[] = [];
      for (let i = 0; i < 50 && !names.includes('meanwhile'); i++) {
        names = await toolNames(client);
        if (!names.includes('meanwhile')) await sleep(10);
      }
      expect(names).toEqual(['admin-only', 'meanwhile', 'public']);
      await client.close();
    });
  });

  describe('a stateful session whose token changes', () => {
    let app: any;
    let url: URL;
    /** While set, resolving visibility for an admin token waits for `hold.release()`. */
    let hold:
      | {
          entered: Promise<void>;
          enter(): void;
          released: Promise<void>;
          release(): void;
        }
      | undefined;
    const toolFilter = jest.fn(
      async (_tool: unknown, authInfo: McpAuthInfo | undefined) => {
        const current = hold;
        if (current && authInfo?.scopes.includes('admin')) {
          current.enter();
          await current.released;
        }
        return true;
      },
    );

    function holdAdminResolution() {
      let enter!: () => void;
      let release!: () => void;
      const entered = new Promise<void>((resolve) => (enter = resolve));
      const released = new Promise<void>((resolve) => (release = resolve));
      hold = {
        entered,
        enter,
        released,
        release: () => {
          hold = undefined;
          release();
        },
      };
      return hold;
    }

    beforeEach(async () => {
      hold = undefined;
      toolFilter.mockClear();
      ({ app, url } = await startApp({
        session: {},
        toolVisibility: 'authorized',
        toolFilter,
      }));
    });

    let afterTest: (() => void) | undefined;

    afterEach(async () => {
      hold?.release();
      afterTest?.();
      afterTest = undefined;
      await app?.close();
    });

    /** A 2025-era client whose bearer token can change between requests, as after step-up. */
    async function connectWithToken(initialToken: string) {
      const auth = { token: initialToken };
      const client = new Client(
        { name: 'step-up-client', version: '1.0.0' },
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
      await client.listTools();
      // Let the standalone SSE stream, where list-changed notifications go, open.
      await new Promise((resolve) => setTimeout(resolve, 50));
      let toolsChanged = 0;
      client.setNotificationHandler('notifications/tools/list_changed', () => {
        toolsChanged++;
      });
      return { client, transport, auth, toolsChanged: () => toolsChanged };
    }

    async function until(condition: () => boolean) {
      for (let i = 0; i < 100 && !condition(); i++) {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(condition()).toBe(true);
    }

    it('shows and runs a tool after the client steps up to a token with its scope', async () => {
      const { client, transport, auth, toolsChanged } =
        await connectWithToken('agent-token');
      const sessionId = transport.sessionId;
      expect(await toolNames(client)).toEqual(['public']);

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
      expect(transport.sessionId).toBe(sessionId);
      expect(await toolNames(client)).toEqual(['admin-only', 'public']);
      await until(() => toolsChanged() >= 1);
      await client.close();
    });

    it('hides the tool again when a later request carries a token without the scope', async () => {
      const { client, auth, toolsChanged } =
        await connectWithToken('admin-token');
      expect(await toolNames(client)).toEqual(['admin-only', 'public']);

      auth.token = 'agent-token';

      expect(await toolNames(client)).toEqual(['public']);
      await until(() => toolsChanged() >= 1);
      await expect(
        client.callTool({ name: 'admin-only', arguments: {} }),
      ).rejects.toThrow(/Insufficient scope/);
      expect(adminCalls).toEqual([]);
      await client.close();
    });

    it('does not resolve the visibility again for the same token', async () => {
      const { client } = await connectWithToken('admin-token');
      const calls = toolFilter.mock.calls.length;

      expect(await toolNames(client)).toEqual(['admin-only', 'public']);
      await client.callTool({ name: 'public', arguments: {} });
      expect(await toolNames(client)).toEqual(['admin-only', 'public']);

      expect(toolFilter.mock.calls.length).toBe(calls);
      await client.close();
    });

    it('keeps setToolEnabled and later registrations in step with the latest token', async () => {
      const registry = app.get(McpToolRegistry) as McpToolRegistry;
      const { client, auth } = await connectWithToken('agent-token');
      registry.setToolEnabled('admin-only', false);

      auth.token = 'admin-token';
      expect(await toolNames(client)).toEqual(['public']);
      registry.setToolEnabled('admin-only', true);
      registry.registerTool(
        { name: 'late-admin', description: 'Admins, later' },
        async () => 'late admin',
        [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
      );
      let names: string[] = [];
      for (let i = 0; i < 50 && !names.includes('late-admin'); i++) {
        names = await toolNames(client);
        if (!names.includes('late-admin')) {
          await new Promise((resolve) => setTimeout(resolve, 10));
        }
      }
      expect(names).toEqual(['admin-only', 'late-admin', 'public']);
      await client.close();
    });

    /** A raw 2025-era `tools/list` on the client's session, with a token of its own. */
    async function listWithToken(transport: any, token: string) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          accept: 'application/json, text/event-stream',
          authorization: `Bearer ${token}`,
          'mcp-session-id': transport.sessionId,
          'mcp-protocol-version': transport._protocolVersion,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'raw',
          method: 'tools/list',
          params: {},
        }),
      });
      const body = await response.text();
      const json = body.startsWith('{')
        ? JSON.parse(body)
        : JSON.parse(
            body
              .split('\n')
              .find((line) => line.startsWith('data: '))!
              .slice('data: '.length),
          );
      return (json.result.tools as Array<{ name: string }>)
        .map((tool) => tool.name)
        .sort();
    }

    it('is not narrowed again by a request still carrying the token it moved past', async () => {
      const { client, transport, auth } = await connectWithToken('agent-token');

      // The stepped-up call's re-resolution is held while an old-token request arrives.
      const held = holdAdminResolution();
      auth.token = 'admin-token';
      const call = client.callTool({ name: 'admin-only', arguments: {} });
      await held.entered;
      const oldTokenList = listWithToken(transport, 'agent-token');
      await new Promise((resolve) => setTimeout(resolve, 50));
      held.release();

      const result: any = await call;
      expect(result.content[0].text).toBe('admin');
      expect(adminCalls).toEqual(['admin-only']);
      expect(await oldTokenList).toEqual(['public']);
      await new Promise((resolve) => setTimeout(resolve, 50));
      // The session's own server still has the tool. (Asked directly: a request with the new
      // token would re-resolve on the old code and hide a session left narrowed.)
      const session = (app.get(McpHttpService) as any).sessions.get(
        transport.sessionId,
      );
      expect(Object.keys(session.server._registeredTools).sort()).toEqual([
        'admin-only',
        'public',
      ]);
      expect(await toolNames(client)).toEqual(['admin-only', 'public']);
      await client.close();
    });

    it('serves a request with a token the session moved past without resolving again or notifying', async () => {
      const { client, transport, auth, toolsChanged } =
        await connectWithToken('agent-token');
      auth.token = 'admin-token';
      expect(await toolNames(client)).toEqual(['admin-only', 'public']);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const calls = toolFilter.mock.calls.length;
      const changes = toolsChanged();

      expect(await listWithToken(transport, 'agent-token')).toEqual([
        'admin-only',
        'public',
      ]);
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(toolFilter.mock.calls.length).toBe(calls);
      expect(toolsChanged()).toBe(changes);
      expect(await toolNames(client)).toEqual(['admin-only', 'public']);
      await client.close();
    });

    it('remembers at most 16 tokens, never forgets the applied one, and re-resolves a forgotten one', async () => {
      // Seventeen admin tokens of the same client, each a key the session hasn't seen.
      const extraTokens = Array.from({ length: 17 }, (_, i) => `admin-${i}`);
      for (const token of extraTokens) TOKENS[token] = ['admin'];
      afterTest = () => extraTokens.forEach((token) => delete TOKENS[token]);
      const key = (token: string) => JSON.stringify([token, TOKENS[token]]);

      const { client, transport } = await connectWithToken('agent-token');
      const session = (app.get(McpHttpService) as any).sessions.get(
        transport.sessionId,
      );
      const visibility = session.visibility;
      expect(visibility.applied).toBe(0);

      // Hold their re-resolutions, so the opening (agent) token stays the applied one, and
      // the oldest key, while the session sees more than 16.
      // They are sent one at a time, each once the previous one's key is numbered, so the
      // session numbers them in this order.
      const held = holdAdminResolution();
      const lists: Array<Promise<string[]>> = [];
      try {
        for (const [index, token] of extraTokens.entries()) {
          lists.push(listWithToken(transport, token));
          await until(() => visibility.next === index + 2);
          expect(visibility.seen.size).toBeLessThanOrEqual(16);
        }

        expect(visibility.seen.size).toBe(16);
        expect(visibility.applied).toBe(0);
        expect(visibility.seen.get(key('agent-token'))).toBe(0);
        // The oldest key that wasn't applied (the first extra token) was forgotten.
        expect(visibility.seen.has(key('admin-0'))).toBe(false);
        expect(visibility.seen.get(key('admin-16'))).toBe(17);
      } finally {
        held.release();
      }
      for (const names of await Promise.all(lists)) {
        expect(names).toEqual(['admin-only', 'public']);
      }
      expect(visibility.applied).toBe(17);
      expect(visibility.seen.size).toBe(16);

      // The forgotten token comes back: it counts as new, so the visibility is resolved again.
      const calls = toolFilter.mock.calls.length;
      expect(await listWithToken(transport, 'admin-0')).toEqual([
        'admin-only',
        'public',
      ]);
      expect(toolFilter.mock.calls.length).toBeGreaterThan(calls);
      expect(visibility.seen.get(key('admin-0'))).toBe(18);
      expect(visibility.applied).toBe(18);
      expect(visibility.seen.size).toBe(16);

      // A remembered token the session moved past still doesn't.
      const before = toolFilter.mock.calls.length;
      await listWithToken(transport, 'admin-16');
      expect(toolFilter.mock.calls.length).toBe(before);

      // Once no longer applied, the opening token was the oldest, so `admin-0` coming back
      // pushed it out. The client's next request with it counts as new too, and the session,
      // which keeps working, follows it back to the agent's tools.
      expect(visibility.seen.has(key('agent-token'))).toBe(false);
      expect(await toolNames(client)).toEqual(['public']);
      expect(visibility.applied).toBe(19);
      expect(visibility.seen.size).toBe(16);
      await client.close();
    });
  });
});
