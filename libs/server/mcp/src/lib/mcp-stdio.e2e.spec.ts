import { Injectable, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/client';
import type { Transport } from '@modelcontextprotocol/client';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/server';
import type { JSONRPCMessage } from '@modelcontextprotocol/server';
import { PassThrough } from 'node:stream';
import { z } from 'zod';
import { McpStdioModule } from './mcp-stdio.module';
import { McpStdioClosedError, McpStdioService } from './mcp-stdio.service';
import type { McpStdioConfig } from './mcp-stdio-config';
import { McpTool } from './mcp-tool.decorator';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpToolContext } from './mcp-tool-context';
import { McpGuard } from './mcp-guard.decorator';
import { McpScopeGuard } from './mcp-scope-guard';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpAuthStrategy } from './mcp-auth-strategy';

// McpStdioModule over in-process streams, called by the MCP SDK's own v2 client in both
// protocol eras.

@Injectable()
class StdioToolService {
  @McpTool({ name: 'whoami', description: 'Describe the call' })
  async whoami(_params: unknown, ctx?: McpToolContext) {
    return { era: ctx?.era };
  }
}

/**
 * A client transport over the server's stdin/stdout, as a spawning client would have.
 * `receive` can rewrite each message from the server before the client sees it.
 */
function streamTransport(
  toServer: PassThrough,
  fromServer: PassThrough,
  receive: (message: JSONRPCMessage) => JSONRPCMessage = (message) => message,
): Transport {
  const buffer = new ReadBuffer();
  const transport: Transport = {
    async start() {
      fromServer.on('data', (chunk: Buffer) => {
        buffer.append(chunk);
        for (
          let message = buffer.readMessage();
          message;
          message = buffer.readMessage()
        ) {
          transport.onmessage?.(receive(message));
        }
      });
    },
    async send(message) {
      toServer.write(serializeMessage(message));
    },
    async close() {
      fromServer.removeAllListeners('data');
      transport.onclose?.();
    },
  };
  return transport;
}

async function startServer(config: Partial<McpStdioConfig> = {}) {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const moduleRef = await Test.createTestingModule({
    imports: [
      McpStdioModule.registerAndServeStdio({
        metadata: { name: 'stdio-e2e', version: '1.0.0' },
        stdin,
        stdout,
        ...config,
      }),
    ],
    providers: [StdioToolService],
  }).compile();
  await moduleRef.init();
  return { moduleRef, stdin, stdout };
}

describe('McpStdioModule end to end with the MCP SDK client', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it.each([
    ['auto', 'modern'],
    ['legacy', 'legacy'],
  ] as const)('serves a client negotiating %s as %s', async (mode, era) => {
    const { moduleRef, stdin, stdout } = await startServer();
    const client = new Client(
      { name: 'stdio-client', version: '1.0.0' },
      { versionNegotiation: { mode } },
    );
    await client.connect(streamTransport(stdin, stdout));

    expect(client.getProtocolEra()).toBe(era);
    const result: any = await client.callTool({
      name: 'whoami',
      arguments: {},
    });
    expect(JSON.parse(result.content[0].text)).toEqual({ era });

    await client.close();
    await moduleRef.close();
  });

  it('applies setToolEnabled made before the client connected', async () => {
    const { moduleRef, stdin, stdout } = await startServer();
    moduleRef.get(McpToolRegistry).setToolEnabled('whoami', false);

    const client = new Client(
      { name: 'stdio-client', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    await client.connect(streamTransport(stdin, stdout));

    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).not.toContain('whoami');
    await client.close();
    await moduleRef.close();
  });

  it('tells a 2026-07-28 client about tools registered later', async () => {
    const { moduleRef, stdin, stdout } = await startServer();
    const client = new Client(
      { name: 'stdio-client', version: '1.0.0' },
      { versionNegotiation: { mode: 'auto' } },
    );
    await client.connect(streamTransport(stdin, stdout));
    const changed = new Promise<void>((resolve) =>
      client.setNotificationHandler('notifications/tools/list_changed', () =>
        resolve(),
      ),
    );
    const subscription = await client.listen({ toolsListChanged: true });

    moduleRef
      .get(McpToolRegistry)
      .registerTool(
        { name: 'late', description: 'Added later' },
        async () => 'late',
      );

    await changed;
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toContain('late');
    await subscription.close();
    await client.close();
    await moduleRef.close();
  });
  describe('a Claude Code channel', () => {
    const channelParams = z.object({
      content: z.string(),
      meta: z.record(z.string(), z.string()).optional(),
    });
    const instructions =
      'Events arrive as <channel source="stdio-e2e" ...>. Read them and act.';

    function startChannel(config: Partial<McpStdioConfig> = {}) {
      return startServer({
        metadata: { name: 'stdio-e2e', version: '1.0.0', instructions },
        capabilities: { experimental: { 'claude/channel': {} } },
        ...config,
      });
    }

    it.each([
      ['auto', 'auto', 'modern'],
      ['auto', 'legacy', 'legacy'],
      ['legacy', 'auto', 'legacy'],
      ['legacy', 'legacy', 'legacy'],
    ] as const)(
      'with protocolNegotiation %s, a client negotiating %s connects as %s and receives channel events',
      async (protocolNegotiation, mode, era) => {
        const { moduleRef, stdin, stdout } = await startChannel({
          protocolNegotiation,
        });
        const stdio = moduleRef.get(McpStdioService);
        expect(stdio.isConnected()).toBe(false);
        await expect(
          stdio.sendNotification('notifications/claude/channel', {
            content: 'too early',
          }),
        ).resolves.toBe(false);

        const client = new Client(
          { name: 'stdio-client', version: '1.0.0' },
          { versionNegotiation: { mode } },
        );
        const received = new Promise<z.infer<typeof channelParams>>((resolve) =>
          client.setNotificationHandler(
            'notifications/claude/channel',
            { params: channelParams },
            (params) => resolve(params),
          ),
        );
        await client.connect(streamTransport(stdin, stdout));
        // A 2026-07-28 client may only have probed with `server/discover` so far; the
        // connection is settled once it makes a request of the era it chose.
        await client.listTools();
        await stdio.whenConnected();

        expect(client.getProtocolEra()).toBe(era);
        expect(stdio.getProtocolEra()).toBe(era);
        expect(client.getServerCapabilities()).toMatchObject({
          experimental: { 'claude/channel': {} },
          tools: { listChanged: true },
        });
        expect(client.getInstructions()).toBe(instructions);

        await expect(
          stdio.sendNotification('notifications/claude/channel', {
            content: 'build failed on main',
            meta: { severity: 'high', run_id: '1234' },
          }),
        ).resolves.toBe(true);
        await expect(received).resolves.toEqual({
          content: 'build failed on main',
          meta: { severity: 'high', run_id: '1234' },
        });

        await client.close();
        await moduleRef.close();
      },
    );

    it('hands each server to onServerCreated, to handle client notifications', async () => {
      const eras: string[] = [];
      let onRequest!: (requestId: string) => void;
      const requested = new Promise<string>((resolve) => (onRequest = resolve));
      const { moduleRef, stdin, stdout } = await startChannel({
        protocolNegotiation: 'legacy',
        capabilities: {
          experimental: {
            'claude/channel': {},
            'claude/channel/permission': {},
          },
        },
        onServerCreated: (server, { era }) => {
          eras.push(era);
          server.server.setNotificationHandler(
            'notifications/claude/channel/permission_request',
            { params: z.object({ request_id: z.string() }) },
            (params) => onRequest(params.request_id),
          );
        },
      });

      const client = new Client(
        { name: 'stdio-client', version: '1.0.0' },
        { versionNegotiation: { mode: 'auto' } },
      );
      await client.connect(streamTransport(stdin, stdout));
      await moduleRef.get(McpStdioService).whenConnected();
      expect(client.getServerCapabilities()?.experimental).toEqual({
        'claude/channel': {},
        'claude/channel/permission': {},
      });

      await client.notification({
        method: 'notifications/claude/channel/permission_request',
        params: { request_id: 'abcde' },
      });

      await expect(requested).resolves.toBe('abcde');
      expect(eras).toEqual(['legacy']);
      await client.close();
      await moduleRef.close();
    });

    it('stays ready when onServerCreated replaces the SDK callbacks', async () => {
      const { moduleRef, stdin, stdout } = await startChannel({
        protocolNegotiation: 'legacy',
        onServerCreated: (server) => {
          server.server.oninitialized = () => undefined;
          server.server.onclose = () => undefined;
        },
      });
      const stdio = moduleRef.get(McpStdioService);
      const client = new Client(
        { name: 'stdio-client', version: '1.0.0' },
        { versionNegotiation: { mode: 'legacy' } },
      );
      await client.connect(streamTransport(stdin, stdout));

      await stdio.whenConnected();
      expect(stdio.isConnected()).toBe(true);
      await client.close();
      await moduleRef.close();
    });

    it('leaves nothing behind when onServerCreated throws', async () => {
      const failure = new Error('hook failed');
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const moduleRef = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'stdio-e2e', version: '1.0.0' },
            stdin,
            stdout,
            protocolNegotiation: 'legacy',
            onServerCreated: () => {
              throw failure;
            },
          }),
        ],
      }).compile();

      await expect(moduleRef.init()).rejects.toBe(failure);
      const stdio = moduleRef.get(McpStdioService);
      expect(stdio.getProtocolEra()).toBeUndefined();
      expect(stdio.isConnected()).toBe(false);
      // Nest's close() reports the failed init again.
      await moduleRef.close().catch(() => undefined);
    });

    it('is not ready during a server/discover probe that the client then abandons for initialize', async () => {
      const { moduleRef, stdin, stdout } = await startChannel();
      const stdio = moduleRef.get(McpStdioService);
      const duringProbe: Array<Promise<unknown> | unknown> = [];
      const client = new Client(
        { name: 'stdio-client', version: '1.0.0' },
        { versionNegotiation: { mode: 'auto' } },
      );
      const received = new Promise<string>((resolve) =>
        client.setNotificationHandler(
          'notifications/claude/channel',
          { params: z.object({ content: z.string() }) },
          (params) => resolve(params.content),
        ),
      );

      // The server answers the probe; the client is told it didn't, and falls back.
      await client.connect(
        streamTransport(stdin, stdout, (message) => {
          // Only the `server/discover` result carries `supportedVersions`.
          if (
            !('result' in message) ||
            !('supportedVersions' in message.result)
          ) {
            return message;
          }
          duringProbe.push(
            stdio.getProtocolEra(),
            stdio.isConnected(),
            stdio.sendNotification('notifications/claude/channel', {
              content: 'during the probe',
            }),
          );
          return {
            jsonrpc: '2.0',
            id: message.id,
            error: { code: -32601, message: 'Method not found' },
          } as JSONRPCMessage;
        }),
      );
      await stdio.whenConnected();

      expect(await Promise.all(duringProbe)).toEqual(['modern', false, false]);
      expect(client.getProtocolEra()).toBe('legacy');
      expect(stdio.getProtocolEra()).toBe('legacy');
      expect(stdio.isConnected()).toBe(true);
      await expect(
        stdio.sendNotification('notifications/claude/channel', {
          content: 'after the fallback',
        }),
      ).resolves.toBe(true);
      await expect(received).resolves.toBe('after the fallback');
      await client.close();
      await moduleRef.close();
    });

    it('is ready once a 2026-07-28 client that probed opens only a subscriptions/listen stream', async () => {
      const { moduleRef, stdin, stdout } = await startChannel();
      const stdio = moduleRef.get(McpStdioService);
      const client = new Client(
        { name: 'stdio-client', version: '1.0.0' },
        { versionNegotiation: { mode: 'auto' } },
      );
      const received = new Promise<string>((resolve) =>
        client.setNotificationHandler(
          'notifications/claude/channel',
          { params: z.object({ content: z.string() }) },
          (params) => resolve(params.content),
        ),
      );
      await client.connect(streamTransport(stdin, stdout));
      expect(client.getProtocolEra()).toBe('modern');
      expect(stdio.isConnected()).toBe(false);

      const subscription = await client.listen({ toolsListChanged: true });
      await stdio.whenConnected();

      expect(stdio.getProtocolEra()).toBe('modern');
      await expect(
        stdio.sendNotification('notifications/claude/channel', {
          content: 'after listen',
        }),
      ).resolves.toBe(true);
      await expect(received).resolves.toBe('after listen');
      await subscription.close();
      await client.close();
      await moduleRef.close();
    });

    /**
     * A client of hand-written JSON-RPC lines, for openings the SDK client never makes
     * (it always probes, and only claims revisions it supports).
     */
    const rawClient = (stdin: PassThrough, stdout: PassThrough) => {
      const buffer = new ReadBuffer();
      const fromServer: JSONRPCMessage[] = [];
      const waiting: Array<() => void> = [];
      stdout.on('data', (chunk: Buffer) => {
        buffer.append(chunk);
        for (let m = buffer.readMessage(); m; m = buffer.readMessage()) {
          fromServer.push(m);
          waiting.splice(0).forEach((wake) => wake());
        }
      });
      return {
        send: (message: JSONRPCMessage) =>
          stdin.write(serializeMessage(message)),
        nextFromServer: async (index: number) => {
          while (fromServer.length <= index) {
            await new Promise<void>((resolve) => waiting.push(resolve));
          }
          return fromServer[index];
        },
      };
    };
    const modernMeta = (protocolVersion: string) => ({
      'io.modelcontextprotocol/protocolVersion': protocolVersion,
      'io.modelcontextprotocol/clientInfo': {
        name: 'raw-client',
        version: '1.0.0',
      },
      'io.modelcontextprotocol/clientCapabilities': {},
    });

    it('is ready once a 2026-07-28 client that opens without probing is answered', async () => {
      const { moduleRef, stdin, stdout } = await startChannel();
      const stdio = moduleRef.get(McpStdioService);
      const { send, nextFromServer } = rawClient(stdin, stdout);

      expect(stdio.isConnected()).toBe(false);
      const connected = stdio.whenConnected();
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: modernMeta('2026-07-28') },
      });

      const answer: any = await nextFromServer(0);
      expect(answer.id).toBe(1);
      expect(answer.result.tools.map((tool: any) => tool.name)).toContain(
        'whoami',
      );
      await connected;
      expect(stdio.isConnected()).toBe(true);
      expect(stdio.getProtocolEra()).toBe('modern');

      await expect(
        stdio.sendNotification('notifications/claude/channel', {
          content: 'unprobed',
          meta: { run_id: '7' },
        }),
      ).resolves.toBe(true);
      expect(await nextFromServer(1)).toEqual({
        jsonrpc: '2.0',
        method: 'notifications/claude/channel',
        params: { content: 'unprobed', meta: { run_id: '7' } },
      });
      await moduleRef.close();
    });

    it('is not ready after a refused 2026-07-28 claim, a probe and a fallback to initialize', async () => {
      const { moduleRef, stdin, stdout } = await startChannel();
      const stdio = moduleRef.get(McpStdioService);
      const { send, nextFromServer } = rawClient(stdin, stdout);

      // A revision the server doesn't support is refused, and doesn't pin the connection.
      send({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/list',
        params: { _meta: modernMeta('2099-01-01') },
      });
      const refused: any = await nextFromServer(0);
      expect(refused.id).toBe(1);
      expect(refused.error).toBeDefined();

      // The probe is answered, but the client hasn't chosen the 2026-07-28 era.
      send({
        jsonrpc: '2.0',
        id: 2,
        method: 'server/discover',
        params: { _meta: modernMeta('2026-07-28') },
      });
      const probe: any = await nextFromServer(1);
      expect(probe.id).toBe(2);
      expect(probe.result).toBeDefined();
      expect(stdio.isConnected()).toBe(false);
      await expect(
        stdio.sendNotification('notifications/claude/channel', {
          content: 'during the probe',
        }),
      ).resolves.toBe(false);

      // The client falls back to the 2025-era handshake, and is ready once it completes.
      const connected = stdio.whenConnected();
      send({
        jsonrpc: '2.0',
        id: 3,
        method: 'initialize',
        params: {
          protocolVersion: '2025-11-25',
          capabilities: {},
          clientInfo: { name: 'raw-client', version: '1.0.0' },
        },
      });
      const initialized: any = await nextFromServer(2);
      expect(initialized.id).toBe(3);
      expect(stdio.isConnected()).toBe(false);
      send({ jsonrpc: '2.0', method: 'notifications/initialized' });
      await connected;
      expect(stdio.getProtocolEra()).toBe('legacy');
      await expect(
        stdio.sendNotification('notifications/claude/channel', {
          content: 'after the fallback',
        }),
      ).resolves.toBe(true);
      expect(await nextFromServer(3)).toEqual({
        jsonrpc: '2.0',
        method: 'notifications/claude/channel',
        params: { content: 'after the fallback' },
      });
      await moduleRef.close();
    });

    it('rejects pending and later whenConnected calls once the module shuts down', async () => {
      const { moduleRef } = await startChannel();
      const stdio = moduleRef.get(McpStdioService);
      const pending = stdio.whenConnected();

      await moduleRef.close();

      await expect(pending).rejects.toBeInstanceOf(McpStdioClosedError);
      await expect(stdio.whenConnected()).rejects.toBeInstanceOf(
        McpStdioClosedError,
      );
      await expect(
        stdio.sendNotification('notifications/claude/channel', {
          content: 'too late',
        }),
      ).resolves.toBe(false);
    });

    it('rejects whenConnected and stops sending once the client goes away', async () => {
      let onServerClosed!: () => void;
      const serverClosed = new Promise<void>(
        (resolve) => (onServerClosed = resolve),
      );
      const { moduleRef, stdin, stdout } = await startChannel({
        protocolNegotiation: 'legacy',
        onServerCreated: (server) => {
          server.server.onclose = onServerClosed;
        },
      });
      const stdio = moduleRef.get(McpStdioService);
      const client = new Client(
        { name: 'stdio-client', version: '1.0.0' },
        { versionNegotiation: { mode: 'legacy' } },
      );
      await client.connect(streamTransport(stdin, stdout));
      await stdio.whenConnected();
      stdin.end();
      await serverClosed;

      await expect(stdio.whenConnected()).rejects.toBeInstanceOf(
        McpStdioClosedError,
      );

      expect(stdio.isConnected()).toBe(false);
      await expect(
        stdio.sendNotification('notifications/claude/channel', {
          content: 'too late',
        }),
      ).resolves.toBe(false);
      await client.close();
      await moduleRef.close();
    });

    it('rejects whenConnected with the reason when its signal aborts', async () => {
      const { moduleRef } = await startChannel();
      const stdio = moduleRef.get(McpStdioService);
      const controller = new AbortController();
      const reason = new Error('gave up');

      const pending = stdio.whenConnected(controller.signal);
      controller.abort(reason);

      await expect(pending).rejects.toBe(reason);
      await expect(stdio.whenConnected(controller.signal)).rejects.toBe(reason);
      await moduleRef.close();
    });

    it('resolves false, without rejecting, when the SDK refuses a notification', async () => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { moduleRef, stdin, stdout } = await startChannel({
        protocolNegotiation: 'legacy',
      });
      const stdio = moduleRef.get(McpStdioService);
      const client = new Client(
        { name: 'stdio-client', version: '1.0.0' },
        { versionNegotiation: { mode: 'legacy' } },
      );
      await client.connect(streamTransport(stdin, stdout));
      await stdio.whenConnected();

      // The server has no resources, so the SDK refuses a resources notification.
      await expect(
        stdio.sendNotification('notifications/resources/list_changed'),
      ).resolves.toBe(false);
      await client.close();
      await moduleRef.close();
    });
  });

  describe('per-caller tool visibility', () => {
    // Stdio carries no token: the auth strategy says who the client is.
    let stdioScopes: string[] = [];
    const adminCalls: string[] = [];

    @Injectable()
    class ScopesAuthStrategy implements McpAuthStrategy {
      async resolveAuth(): Promise<McpAuthInfo> {
        return { token: 'local', clientId: 'local', scopes: stdioScopes };
      }
    }

    @Injectable()
    class ScopedToolService {
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

    async function startScoped(config: Partial<McpStdioConfig>) {
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const moduleRef = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'stdio-visibility', version: '1.0.0' },
            stdin,
            stdout,
            exposeErrorMessages: true,
            authStrategy: ScopesAuthStrategy,
            ...config,
          }),
        ],
        providers: [ScopedToolService, ScopesAuthStrategy],
      }).compile();
      await moduleRef.init();
      return { moduleRef, stdin, stdout };
    }

    async function connectScoped(
      config: Partial<McpStdioConfig>,
      mode: 'auto' | 'legacy',
    ) {
      const { moduleRef, stdin, stdout } = await startScoped(config);
      const client = new Client(
        { name: 'stdio-client', version: '1.0.0' },
        { versionNegotiation: { mode } },
      );
      await client.connect(streamTransport(stdin, stdout));
      const names = (await client.listTools()).tools
        .map((tool) => tool.name)
        .sort();
      return { moduleRef, client, names };
    }

    beforeEach(() => {
      adminCalls.length = 0;
    });

    describe.each(['auto', 'legacy'] as const)(
      'a client negotiating %s',
      (mode) => {
        it("hides the admin tool from a non-admin client with toolVisibility: 'authorized', and refuses the call", async () => {
          stdioScopes = ['agent'];
          const { moduleRef, client, names } = await connectScoped(
            { toolVisibility: 'authorized' },
            mode,
          );

          expect(names).toEqual(['public']);
          await expect(
            client.callTool({ name: 'admin-only', arguments: {} }),
          ).rejects.toThrow(/Tool admin-only not found/);
          expect(adminCalls).toEqual([]);
          await client.close();
          await moduleRef.close();
        });

        it("lists the admin tool to an admin client with toolVisibility: 'authorized'", async () => {
          stdioScopes = ['admin'];
          const { moduleRef, client, names } = await connectScoped(
            { toolVisibility: 'authorized' },
            mode,
          );

          expect(names).toEqual(['admin-only', 'public']);
          const result: any = await client.callTool({
            name: 'admin-only',
            arguments: {},
          });
          expect(result.content[0].text).toBe('admin');
          await client.close();
          await moduleRef.close();
        });

        it('lists every tool by default, and the guard still refuses the call', async () => {
          stdioScopes = ['agent'];
          const { moduleRef, client, names } = await connectScoped({}, mode);

          expect(names).toEqual(['admin-only', 'public']);
          const result: any = await client.callTool({
            name: 'admin-only',
            arguments: {},
          });
          expect(result.isError).toBe(true);
          expect(result.content[0].text).toMatch(/Access denied/);
          expect(adminCalls).toEqual([]);
          await client.close();
          await moduleRef.close();
        });

        it('lists a tool registered while a request was being decided', async () => {
          stdioScopes = ['admin'];
          let blocking = false;
          let entered!: () => void;
          let release!: () => void;
          const enteredPromise = new Promise<void>((r) => (entered = r));
          const released = new Promise<void>((r) => (release = r));
          const { moduleRef, stdin, stdout } = await startScoped({
            toolVisibility: 'authorized',
            toolFilter: async () => {
              if (blocking) {
                entered();
                await released;
              }
              return true;
            },
          });
          const client = new Client(
            { name: 'stdio-client', version: '1.0.0' },
            { versionNegotiation: { mode } },
          );
          await client.connect(streamTransport(stdin, stdout));

          blocking = true;
          const listing = client.listTools();
          await enteredPromise;
          moduleRef
            .get(McpToolRegistry)
            .registerTool(
              { name: 'meanwhile', description: 'Registered while deciding' },
              async () => 'meanwhile',
              [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
            );
          blocking = false;
          release();
          await listing;

          const names = (await client.listTools()).tools.map(
            (tool) => tool.name,
          );
          expect(names.sort()).toEqual(['admin-only', 'meanwhile', 'public']);
          await client.close();
          await moduleRef.close();
        });

        it('decides each request by the auth the strategy gives it then', async () => {
          stdioScopes = ['agent'];
          const { moduleRef, client, names } = await connectScoped(
            { toolVisibility: 'authorized' },
            mode,
          );
          expect(names).toEqual(['public']);

          stdioScopes = ['admin'];
          const listed = (await client.listTools()).tools.map(
            (tool) => tool.name,
          );
          expect(listed.sort()).toEqual(['admin-only', 'public']);

          stdioScopes = ['agent'];
          await expect(
            client.callTool({ name: 'admin-only', arguments: {} }),
          ).rejects.toThrow(/Tool admin-only not found/);
          await client.close();
          await moduleRef.close();
        });

        it('lists and serves a tool onServerCreated registers, as without rules', async () => {
          stdioScopes = ['agent'];
          const { moduleRef, client, names } = await connectScoped(
            {
              toolVisibility: 'authorized',
              onServerCreated: (server) => {
                server.registerTool(
                  'outside',
                  { description: "Not the registry's" },
                  async () => ({
                    content: [{ type: 'text', text: 'outside' }],
                  }),
                );
              },
            },
            mode,
          );

          expect(names).toEqual(['outside', 'public']);
          const result: any = await client.callTool({
            name: 'outside',
            arguments: {},
          });
          expect(result.content[0].text).toBe('outside');
          await client.close();
          await moduleRef.close();
        });

        it('applies toolFilter', async () => {
          stdioScopes = ['admin'];
          const { moduleRef, client, names } = await connectScoped(
            {
              toolVisibility: 'authorized',
              toolFilter: (tool, authInfo) =>
                tool.name !== 'public' || !authInfo?.scopes.includes('admin'),
            },
            mode,
          );

          expect(names).toEqual(['admin-only']);
          // Enforced on each call too.
          await expect(
            client.callTool({ name: 'public', arguments: {} }),
          ).rejects.toThrow(/Tool public not found/);
          await client.close();
          await moduleRef.close();
        });
      },
    );
  });
});
