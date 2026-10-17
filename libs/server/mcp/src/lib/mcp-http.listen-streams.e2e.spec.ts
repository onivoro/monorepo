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
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import type { McpListenStream } from './mcp-listen-stream';
import type { McpModuleConfig } from './mcp-module-config';

// Closing and gating 2026-07-28 subscriptions/listen streams, over real HTTP with the MCP SDK's
// own client, against a stateless server whose bearer tokens are sessions that can end.

/** Open sessions, by token. Ending one is deleting it. */
const sessions = new Set<string>();
/** Each acceptListenStream call's stream. */
const gateCalls: McpListenStream[] = [];
/** What acceptListenStream does before it answers, if anything. */
let beforeGateAnswers: (() => void | Promise<void>) | undefined;

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
    return sessions.has(stream.authInfo?.token ?? '');
  }
}

@Injectable()
class InboxResource {
  @McpResource({ name: 'inbox', uri: 'app://inbox' })
  async inbox() {
    return '[]';
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

async function connect(url: URL, token: string) {
  const client = new Client(
    { name: 'listen-client', version: '1.0.0' },
    { versionNegotiation: { mode: 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  const updates: string[] = [];
  client.setNotificationHandler('notifications/resources/updated', (n) => {
    updates.push(n.params.uri);
  });
  return { client, updates };
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
    // The SDK's side of each closed stream has stopped listening for changes.
    await until(() => (service as any).modern.bus.listenerCount === 1);

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

    await expect(
      client.listen({ resourceSubscriptions: ['app://inbox'] }),
    ).rejects.toThrow('Listen stream refused');
    expect(service.getListenStreams()).toEqual([]);
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

    await expect(opening).rejects.toThrow('Listen stream refused');
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

    await expect(
      client.listen({ resourceSubscriptions: ['app://inbox'] }),
    ).rejects.toThrow('Listen stream refused');
    expect(warn).toHaveBeenCalledWith(
      'The listen-stream gate failed, so a subscriptions/listen stream was refused: session store unreachable',
    );
    warn.mockRestore();
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
