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
import { McpHttpModule } from './mcp-http.module';
import { McpHttpService } from './mcp-http.service';
import { McpResource } from './mcp-resource.decorator';
import { McpTool } from './mcp-tool.decorator';
import type { McpToolContext } from './mcp-tool-context';
import * as buildMcpServerModule from './build-mcp-server';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import {
  MCP_LISTEN_STREAM_REFUSED,
  type McpListenStream,
  type McpListenStreamRefusal,
} from './mcp-listen-stream';
import type { McpModuleConfig } from './mcp-module-config';

// Closing and gating 2026-07-28 subscriptions/listen streams, over real HTTP with the MCP SDK's
// own client, against a stateless server whose bearer tokens are sessions that can end.

/** Open sessions, by token. Ending one is deleting it. */
const sessions = new Set<string>();
/** Each acceptListenStream call's stream. */
const gateCalls: McpListenStream[] = [];
/** What acceptListenStream does before it answers, if anything. */
let beforeGateAnswers: (() => void | Promise<void>) | undefined;
/** What acceptListenStream answers for an open session. */
let gateAnswerForEnded: false | McpListenStreamRefusal = false;

@Injectable()
class SessionAuth implements McpAuthStrategy, OAuthTokenVerifier {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    if (!sessions.has(token)) {
      throw new OAuthError(OAuthErrorCode.InvalidToken, 'Session ended');
    }
    return {
      token,
      clientId: token,
      scopes: ['agent'],
      expiresAt: Math.floor(Date.now() / 1000) + 3600,
    };
  }

  resolveAuth(authInfo?: McpAuthInfo) {
    return authInfo;
  }

  async acceptListenStream(stream: McpListenStream) {
    gateCalls.push(stream);
    await beforeGateAnswers?.();
    return sessions.has(stream.authInfo?.token ?? '') || gateAnswerForEnded;
  }
}

@Injectable()
class InboxResource {
  @McpResource({ name: 'inbox', uri: 'app://inbox' })
  async inbox() {
    return '[]';
  }

  @McpTool({ name: 'work', description: 'Reports progress' })
  async work(_params: unknown, ctx?: McpToolContext) {
    await ctx?.sendProgress?.(1, 2, 'half');
    return 'done';
  }
}

async function startApp(config: Partial<McpModuleConfig> = {}) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      McpHttpModule.registerAndServeHttp({
        metadata: { name: 'listen-e2e', version: '1.2.3' },
        authStrategy: SessionAuth,
        requireBearerAuth: true,
        ...config,
      }),
    ],
    providers: [SessionAuth, InboxResource],
  }).compile();
  const app = moduleRef.createNestApplication({ logger: false });
  await app.listen(0, '127.0.0.1');
  const { port } = app.getHttpServer().address() as AddressInfo;
  return {
    app,
    service: moduleRef.get(McpHttpService),
    registry: moduleRef.get(McpToolRegistry),
    url: new URL(`http://localhost:${port}/mcp`),
  };
}

/** The last subscriptions/listen request a client sent, to replay by hand. */
let lastListen: { url: string; headers: Headers; body: any } | undefined;

async function connect(url: URL, token: string) {
  const client = new Client(
    { name: 'listen-client', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
    fetch: async (input, init) => {
      const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
      if (body.method === 'subscriptions/listen') {
        lastListen = {
          url: String(input),
          headers: new Headers(init?.headers),
          body,
        };
      }
      return fetch(input, init);
    },
  });
  await client.connect(transport);
  const updates: string[] = [];
  client.setNotificationHandler('notifications/resources/updated', (n) => {
    updates.push(n.params.uri);
  });
  return { client, updates };
}

/** A listen request's refusal, as the client got it. */
async function refusalOf(listening: Promise<unknown>) {
  const error: any = await listening.then(
    () => {
      throw new Error('the stream opened');
    },
    (e) => e,
  );
  expect(error.message).toContain('Listen stream refused');
  expect(error.code).toBe(MCP_LISTEN_STREAM_REFUSED);
  return error.data?.reason as string;
}

/** Replays the last listen request by hand with a different body. */
function replayListen(body: unknown, signal?: AbortSignal) {
  return fetch(lastListen!.url, {
    method: 'POST',
    headers: lastListen!.headers,
    body: JSON.stringify(body),
    signal,
  });
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 50));

async function until(condition: () => boolean, timeoutMs = 2000) {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

describe('McpHttpService listen streams, end to end', () => {
  let app: any;
  let service: McpHttpService;
  let registry: McpToolRegistry;
  let url: URL;
  const clients: Client[] = [];

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    ({ app, service, registry, url } = await startApp());
  });

  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  beforeEach(() => {
    sessions.clear();
    sessions.add('alice').add('bob');
    gateCalls.length = 0;
    beforeGateAnswers = undefined;
    gateAnswerForEnded = false;
  });

  afterEach(async () => {
    await Promise.all(clients.splice(0).map((c) => c.close()));
    await until(() => service.getListenStreams().length === 0);
  });

  async function listening(token: string) {
    const { client, updates } = await connect(url, token);
    clients.push(client);
    const subscription = await client.listen({
      resourceSubscriptions: ['app://inbox'],
    });
    return { client, updates, subscription };
  }

  it('lists each open stream with the verified auth it was opened with', async () => {
    await listening('alice');
    await listening('bob');

    const streams = service.getListenStreams();
    expect(streams.map((s) => s.authInfo?.token).sort()).toEqual([
      'alice',
      'bob',
    ]);
    for (const stream of streams) {
      expect(stream.subscriptionId).toBeDefined();
      expect(stream.openedAt).toBeLessThanOrEqual(Date.now());
    }
  });

  it("closes only the picked caller's streams, gracefully, and sends them nothing more", async () => {
    const alice = await listening('alice');
    const alice2 = await listening('alice');
    const bob = await listening('bob');

    sessions.delete('alice');
    const picked = service.closeListenStreams(
      (s) => s.authInfo?.token === 'alice',
    );

    expect(picked).toBe(2);
    await expect(alice.subscription.closed).resolves.toBe('graceful');
    await expect(alice2.subscription.closed).resolves.toBe('graceful');
    expect(service.getListenStreams().map((s) => s.authInfo?.token)).toEqual([
      'bob',
    ]);
    registry.notifyResourceUpdated('app://inbox');
    await until(() => bob.updates.length === 1);
    await settle();
    expect(bob.updates).toEqual(['app://inbox']);
    expect(alice.updates).toEqual([]);
    expect(alice2.updates).toEqual([]);
  });

  it('closes every stream when no predicate is given', async () => {
    const alice = await listening('alice');
    const bob = await listening('bob');

    expect(service.closeListenStreams()).toBe(2);

    await expect(alice.subscription.closed).resolves.toBe('graceful');
    await expect(bob.subscription.closed).resolves.toBe('graceful');
    expect(service.getListenStreams()).toEqual([]);
  });

  it('consults acceptListenStream with the verified auth before a stream opens', async () => {
    await listening('alice');

    expect(gateCalls).toHaveLength(1);
    expect(gateCalls[0].authInfo).toMatchObject({
      token: 'alice',
      clientId: 'alice',
    });
  });

  it('refuses a stream acceptListenStream rejects, and tracks nothing for it', async () => {
    const { client } = await connect(url, 'alice');
    clients.push(client);
    // The token still verifies, but the session ends before the stream opens.
    beforeGateAnswers = () => {
      sessions.delete('alice');
    };

    expect(
      await refusalOf(
        client.listen({ resourceSubscriptions: ['app://inbox'] }),
      ),
    ).toBe('refused');
    expect(service.getListenStreams()).toEqual([]);
  });

  it("gives the client acceptListenStream's own reason", async () => {
    const { client } = await connect(url, 'alice');
    clients.push(client);
    sessions.delete('alice');
    // The token still verifies (checked before the session ends), the gate refuses.
    beforeGateAnswers = undefined;
    gateAnswerForEnded = { reason: 'session_ended' };
    sessions.add('alice');
    beforeGateAnswers = () => {
      sessions.delete('alice');
    };

    expect(
      await refusalOf(
        client.listen({ resourceSubscriptions: ['app://inbox'] }),
      ),
    ).toBe('session_ended');
  });

  it('refuses a stream closed while acceptListenStream runs', async () => {
    const { client } = await connect(url, 'alice');
    clients.push(client);
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    beforeGateAnswers = () => held;

    const opening = client.listen({ resourceSubscriptions: ['app://inbox'] });
    await until(() => gateCalls.length === 1);
    // Opening streams are listed, so a sweep before a change sees them too.
    expect(service.getListenStreams().map((s) => s.authInfo?.token)).toEqual([
      'alice',
    ]);
    expect(
      service.closeListenStreams((s) => s.authInfo?.token === 'alice'),
    ).toBe(1);
    release();

    expect(await refusalOf(opening)).toBe('closed');
    expect(service.getListenStreams()).toEqual([]);
  });

  it('refuses the stream, and says why, when acceptListenStream throws', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const { client } = await connect(url, 'alice');
    clients.push(client);
    beforeGateAnswers = () => {
      throw new Error('session store unreachable');
    };

    expect(
      await refusalOf(
        client.listen({ resourceSubscriptions: ['app://inbox'] }),
      ),
    ).toBe('gate_failed');
    expect(warn).toHaveBeenCalledWith(
      'The listen-stream gate failed, so a subscriptions/listen stream was refused: session store unreachable',
    );
    warn.mockRestore();
  });

  it('closes a stream right after its acknowledgement when the close comes after the gate, before the SDK answers', async () => {
    const { client } = await connect(url, 'alice');
    clients.push(client);
    const original = buildMcpServerModule.buildMcpServer;
    const build = jest.spyOn(buildMcpServerModule, 'buildMcpServer');
    let closedAfterGate = false;
    // The listen request's server is built after the gate has passed, and before the SDK
    // opens the stream.
    build.mockImplementation((...args) => {
      if (gateCalls.length === 1 && !closedAfterGate) {
        closedAfterGate = true;
        expect(service.closeListenStreams()).toBe(1);
      }
      return original(...args);
    });

    try {
      const subscription = await client.listen({
        resourceSubscriptions: ['app://inbox'],
      });

      await expect(subscription.closed).resolves.toBe('graceful');
      expect(closedAfterGate).toBe(true);
    } finally {
      build.mockRestore();
    }
  });

  it('leaves a malformed listen request to the SDK, without consulting the gate', async () => {
    const { client } = await connect(url, 'alice');
    clients.push(client);
    await (await listening('alice')).subscription.close();
    gateCalls.length = 0;

    const response = await replayListen({
      ...lastListen!.body,
      params: {
        ...lastListen!.body.params,
        notifications: { resourceSubscriptions: 'app://inbox' },
      },
    });

    expect(response.status).toBe(200);
    expect(((await response.json()) as any).error.code).toBe(-32602);
    expect(gateCalls).toEqual([]);
    expect(service.getListenStreams()).toEqual([]);
  });

  it('builds no server for a client that went away while the gate ran', async () => {
    await (await listening('alice')).subscription.close();
    await until(() => service.getListenStreams().length === 0);
    gateCalls.length = 0;
    let release!: () => void;
    const held = new Promise<void>((resolve) => (release = resolve));
    beforeGateAnswers = () => held;
    const build = jest.spyOn(buildMcpServerModule, 'buildMcpServer');
    const abort = new AbortController();

    const response = replayListen(lastListen!.body, abort.signal).catch(
      () => undefined,
    );
    await until(() => gateCalls.length === 1);
    abort.abort();
    await until(() => service.getListenStreams().length === 0);
    const builtBefore = build.mock.calls.length;
    release();
    await response;
    await settle();

    expect(build.mock.calls.length).toBe(builtBefore);
    build.mockRestore();
  });

  it('passes a streaming response that is not a listen stream through untouched', async () => {
    const { client } = await connect(url, 'alice');
    clients.push(client);
    const progress: unknown[] = [];

    const result: any = await client.callTool(
      { name: 'work', arguments: {} },
      { onprogress: (p) => progress.push(p) },
    );

    expect(result.content[0].text).toBe('done');
    expect(progress).toEqual([{ progress: 1, total: 2, message: 'half' }]);
    expect(service.getListenStreams()).toEqual([]);
  });

  it('stops tracking a stream the client closes', async () => {
    const { subscription } = await listening('alice');
    expect(service.getListenStreams()).toHaveLength(1);

    await subscription.close();

    await until(() => service.getListenStreams().length === 0);
  });

  it('closes tracked streams gracefully when the app shuts down', async () => {
    const other = await startApp();
    const { client } = await connect(other.url, 'alice');
    const subscription = await client.listen({
      resourceSubscriptions: ['app://inbox'],
    });

    await other.app.close();

    await expect(subscription.closed).resolves.toBe('graceful');
    expect(other.service.getListenStreams()).toEqual([]);
    await client.close();
  });

  it('refuses a stream still at the gate when the app shuts down, and shuts down', async () => {
    const other = await startApp();
    const { client } = await connect(other.url, 'alice');
    beforeGateAnswers = () => new Promise<void>(() => undefined); // never answers

    const opening = client.listen({ resourceSubscriptions: ['app://inbox'] });
    await until(() => gateCalls.length === 1);
    await other.app.close();

    expect(await refusalOf(opening)).toBe('closed');
    expect(other.service.getListenStreams()).toEqual([]);
    await client.close();
  });

  it('refuses a stream whose gate does not answer in time', async () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    const other = await startApp({ listenStreamGateTimeoutMs: 50 });
    const { client } = await connect(other.url, 'alice');
    beforeGateAnswers = () => new Promise<void>(() => undefined);

    try {
      expect(
        await refusalOf(
          client.listen({ resourceSubscriptions: ['app://inbox'] }),
        ),
      ).toBe('gate_timeout');
      expect(other.service.getListenStreams()).toEqual([]);
      expect(warn).toHaveBeenCalledWith(
        "The listen-stream gate didn't answer within 50ms, so a subscriptions/listen stream was refused",
      );
    } finally {
      warn.mockRestore();
      await client.close();
      await other.app.close();
    }
  });
});

describe('McpHttpService listen streams without a gate', () => {
  it('opens and closes streams for an unauthenticated server', async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const moduleRef = await Test.createTestingModule({
      imports: [
        McpHttpModule.registerAndServeHttp({
          metadata: { name: 'plain', version: '1.0.0' },
        }),
      ],
      providers: [InboxResource],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    const service = moduleRef.get(McpHttpService);
    try {
      const client = new Client(
        { name: 'plain-client', version: '1.0.0' },
        { versionNegotiation: { mode: 'auto' } },
      );
      await client.connect(
        new StreamableHTTPClientTransport(
          new URL(`http://localhost:${port}/mcp`),
        ),
      );
      const subscription = await client.listen({
        resourceSubscriptions: ['app://inbox'],
      });

      const [stream, ...others] = service.getListenStreams();
      expect(others).toEqual([]);
      expect(stream).not.toHaveProperty('authInfo');
      expect(service.closeListenStreams()).toBe(1);
      await expect(subscription.closed).resolves.toBe('graceful');
      await client.close();
    } finally {
      await app.close();
      jest.restoreAllMocks();
    }
  });
});
