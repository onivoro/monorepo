import { Injectable, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Client } from '@modelcontextprotocol/client';
import type { Transport } from '@modelcontextprotocol/client';
import { ReadBuffer, serializeMessage } from '@modelcontextprotocol/server';
import { PassThrough } from 'node:stream';
import { McpStdioModule } from './mcp-stdio.module';
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

async function startServer() {
  const stdin = new PassThrough();
  const stdout = new PassThrough();
  const moduleRef = await Test.createTestingModule({
    imports: [
      McpStdioModule.registerAndServeStdio({
        metadata: { name: 'stdio-e2e', version: '1.0.0' },
        stdin,
        stdout,
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
});
