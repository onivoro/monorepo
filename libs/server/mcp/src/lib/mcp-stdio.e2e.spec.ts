import { Injectable, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/client';
import type { Transport } from '@modelcontextprotocol/client';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/server';
import { PassThrough } from 'node:stream';
import { z } from 'zod';
import { McpStdioModule } from './mcp-stdio.module';
import { McpStdioService } from './mcp-stdio.service';
import type { McpStdioConfig } from './mcp-stdio-config';
import { McpTool } from './mcp-tool.decorator';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpToolContext } from './mcp-tool-context';

// McpStdioModule over in-process streams, called by the MCP SDK's own v2 client in both
// protocol eras.

@Injectable()
class StdioToolService {
  @McpTool({ name: 'whoami', description: 'Describe the call' })
  async whoami(_params: unknown, ctx?: McpToolContext) {
    return { era: ctx?.era };
  }
}

/** A client transport over the server's stdin/stdout, as a spawning client would have. */
function streamTransport(
  toServer: PassThrough,
  fromServer: PassThrough,
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
          transport.onmessage?.(message);
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
      const verdicts: unknown[] = [];
      const eras: string[] = [];
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
            (params) => {
              verdicts.push(params.request_id);
            },
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
      await new Promise((resolve) => setTimeout(resolve, 20));

      expect(eras).toEqual(['legacy']);
      expect(verdicts).toEqual(['abcde']);
      await client.close();
      await moduleRef.close();
    });

    it('reports no connection once the client has gone', async () => {
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

      await moduleRef.close();

      expect(stdio.isConnected()).toBe(false);
      await expect(
        stdio.sendNotification('notifications/claude/channel', {
          content: 'too late',
        }),
      ).resolves.toBe(false);
      await client.close();
    });
  });
});
