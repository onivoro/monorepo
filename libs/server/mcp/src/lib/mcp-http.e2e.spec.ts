import { Injectable, Logger } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { LOG_LEVEL_META_KEY } from '@modelcontextprotocol/server';
import type { AddressInfo } from 'net';
import { z } from 'zod';
import { McpHttpModule } from './mcp-http.module';
import { McpTool } from './mcp-tool.decorator';
import { McpResource } from './mcp-resource.decorator';
import { McpPrompt } from './mcp-prompt.decorator';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpToolContext } from './mcp-tool-context';
import type { McpModuleConfig } from './mcp-module-config';
import { acceptedContent, inputRequired } from '@modelcontextprotocol/server';

// A real Nest app served over HTTP, called by the MCP SDK's own v2 client in both protocol
// eras: 2026-07-28 ('modern', stateless) and 2025-11-25 and earlier ('legacy').

const confirmSchema = z.object({ confirm: z.boolean() });

@Injectable()
class E2eToolService {
  @McpTool({ name: 'whoami', description: 'Describe the call' })
  async whoami(_params: unknown, ctx?: McpToolContext) {
    return { era: ctx?.era, sessionId: ctx?.sessionId ?? null };
  }

  @McpTool({
    name: 'deploy',
    description: 'Deploy after confirmation',
    schema: z.object({ env: z.string() }),
  })
  async deploy(params: { env: string }, ctx?: McpToolContext) {
    const answer = acceptedContent(
      ctx?.inputResponses,
      'confirm',
      confirmSchema,
    );
    if (!answer) {
      return inputRequired({
        inputRequests: {
          confirm: inputRequired.elicit({
            message: `Deploy to ${params.env}?`,
            requestedSchema: confirmSchema,
          }),
        },
      });
    }
    return answer.confirm ? `Deployed to ${params.env}` : 'Cancelled';
  }

  @McpTool({ name: 'work', description: 'Report progress and log' })
  async work(_params: unknown, ctx?: McpToolContext) {
    await ctx?.sendProgress?.(1, 2, 'half');
    await ctx?.sendLog?.('debug', 'noise');
    await ctx?.sendLog?.('warning', 'heads up');
    return 'done';
  }

  @McpResource({ name: 'config', uri: 'app://config' })
  async config() {
    return 'v1';
  }

  @McpTool({
    name: 'show',
    description: 'Has a view',
    _meta: { ui: { resourceUri: 'ui://e2e/view.html' } },
  })
  async show() {
    return 'shown';
  }

  @McpResource({
    name: 'view',
    uri: 'ui://e2e/view.html',
    mimeType: 'text/html;profile=mcp-app',
    _meta: { ui: { prefersBorder: true } },
  })
  async view() {
    return '<p>view</p>';
  }

  @McpPrompt({ name: 'report', _meta: { 'acme.com/kind': 'report' } })
  async report() {
    return 'report';
  }
}

async function startApp(config: Partial<McpModuleConfig> = {}) {
  const moduleRef = await Test.createTestingModule({
    imports: [
      McpHttpModule.registerAndServeHttp({
        metadata: { name: 'e2e', version: '1.0.0' },
        ...config,
      }),
    ],
    providers: [E2eToolService],
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

async function connect(url: URL, mode: 'auto' | 'legacy') {
  const client = new Client(
    { name: 'e2e-client', version: '1.0.0' },
    {
      versionNegotiation: { mode },
      capabilities: { elicitation: { form: {} } },
    },
  );
  client.setRequestHandler('elicitation/create', async () => ({
    action: 'accept',
    content: { confirm: true },
  }));
  const transport = new StreamableHTTPClientTransport(url);
  await client.connect(transport);
  return { client, transport };
}

function text(result: any): string {
  return result.content.map((block: any) => block.text).join('');
}

describe('McpHttpModule end to end with the MCP SDK client', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  // With a toolFilter, the module's own tools/list and tools/call handlers serve the tools
  // instead of the SDK's; everything here must behave the same through them.
  describe.each([
    ['stateful', { session: {} }],
    ['stateless', {}],
    ['stateful-filtered', { session: {}, toolFilter: () => true }],
    ['stateless-filtered', { toolFilter: () => true }],
  ] as Array<[string, Partial<McpModuleConfig>]>)(
    '%s server',
    (_name, config) => {
      let app: any;
      let url: URL;

      beforeAll(async () => {
        ({ app, url } = await startApp(config));
      });

      afterAll(async () => {
        await app?.close();
      });

      it('serves a 2026-07-28 client statelessly', async () => {
        const { client, transport } = await connect(url, 'auto');

        expect(client.getProtocolEra()).toBe('modern');
        expect(transport.sessionId).toBeUndefined();
        const tools = await client.listTools();
        expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
          'deploy',
          'show',
          'whoami',
          'work',
        ]);
        expect(
          JSON.parse(
            text(await client.callTool({ name: 'whoami', arguments: {} })),
          ),
        ).toEqual({ era: 'modern', sessionId: null });

        await client.close();
      });

      it.each(['auto', 'legacy'] as const)(
        'advertises tool, resource and prompt _meta (%s client)',
        async (mode) => {
          const { client } = await connect(url, mode);

          const { tools } = await client.listTools();
          const { resources } = await client.listResources();
          const { prompts } = await client.listPrompts();

          expect(tools.find((tool) => tool.name === 'show')?._meta).toEqual({
            ui: { resourceUri: 'ui://e2e/view.html' },
          });
          expect(
            resources.find((r) => r.uri === 'ui://e2e/view.html')?._meta,
          ).toEqual({ ui: { prefersBorder: true } });
          expect(prompts.find((p) => p.name === 'report')?._meta).toEqual({
            'acme.com/kind': 'report',
          });
          await client.close();
        },
      );

      it('serves a 2025-era client', async () => {
        const { client, transport } = await connect(url, 'legacy');

        expect(client.getProtocolEra()).toBe('legacy');
        const whoami = JSON.parse(
          text(await client.callTool({ name: 'whoami', arguments: {} })),
        );
        expect(whoami.era).toBe('legacy');
        if (config.session) {
          expect(transport.sessionId).toEqual(expect.any(String));
          expect(whoami.sessionId).toBe(transport.sessionId);
        }

        await client.close();
      });

      it('asks a 2026-07-28 client for input with inputRequired', async () => {
        const { client } = await connect(url, 'auto');

        const result = await client.callTool({
          name: 'deploy',
          arguments: { env: 'prod' },
        });

        expect(text(result)).toBe('Deployed to prod');
        await client.close();
      });

      it('sends 2026-07-28 progress, and logs at the level the request names', async () => {
        const { client } = await connect(url, 'auto');
        const logs: unknown[] = [];
        client.setNotificationHandler('notifications/message', (n) => {
          logs.push(n.params.data);
        });
        const progress: unknown[] = [];

        const result = await client.callTool(
          {
            name: 'work',
            arguments: {},
            _meta: { [LOG_LEVEL_META_KEY]: 'info' },
          },
          { onprogress: (p) => progress.push(p) },
        );

        expect(text(result)).toBe('done');
        expect(progress).toEqual([{ progress: 1, total: 2, message: 'half' }]);
        expect(logs).toEqual(['heads up']);
        await client.close();
      });

      it('tells a 2026-07-28 client about tools registered later', async () => {
        const { client } = await connect(url, 'auto');
        const changed = new Promise<void>((resolve) =>
          client.setNotificationHandler(
            'notifications/tools/list_changed',
            () => resolve(),
          ),
        );
        const subscription = await client.listen({ toolsListChanged: true });

        const registry = app.get(McpToolRegistry);
        registry.registerTool(
          { name: `late-${_name}`, description: 'Added later' },
          async () => 'late',
        );

        await changed;
        const tools = await client.listTools();
        expect(tools.tools.map((tool) => tool.name)).toContain(`late-${_name}`);
        await subscription.close();
        await client.close();
      });
    },
  );

  describe('2026-07-28 resource subscriptions', () => {
    let app: any;
    let url: URL;

    beforeAll(async () => {
      ({ app, url } = await startApp());
    });

    afterAll(async () => {
      await app?.close();
    });

    it('delivers an update to a client listening for that resource', async () => {
      const { client } = await connect(url, 'auto');
      const updated = new Promise<string>((resolve) =>
        client.setNotificationHandler('notifications/resources/updated', (n) =>
          resolve(n.params.uri),
        ),
      );
      const subscription = await client.listen({
        resourceSubscriptions: ['app://config'],
      });

      app.get(McpToolRegistry).notifyResourceUpdated('app://config');

      await expect(updated).resolves.toBe('app://config');
      await subscription.close();
      await client.close();
    });
  });

  describe('stateful server, 2025-era client', () => {
    let app: any;
    let url: URL;

    beforeAll(async () => {
      ({ app, url } = await startApp({ session: {} }));
    });

    afterAll(async () => {
      await app?.close();
    });

    it('bridges inputRequired to an elicitation request', async () => {
      const { client } = await connect(url, 'legacy');

      const result = await client.callTool({
        name: 'deploy',
        arguments: { env: 'staging' },
      });

      expect(text(result)).toBe('Deployed to staging');
      await client.close();
    });

    it('sends progress, and logs at the level set with logging/setLevel', async () => {
      const { client } = await connect(url, 'legacy');
      const logs: unknown[] = [];
      client.setNotificationHandler('notifications/message', (n) => {
        logs.push(n.params.data);
      });
      await client.setLoggingLevel('info');
      const progress: unknown[] = [];

      const result = await client.callTool(
        { name: 'work', arguments: {} },
        { onprogress: (p) => progress.push(p) },
      );

      expect(text(result)).toBe('done');
      expect(progress).toEqual([{ progress: 1, total: 2, message: 'half' }]);
      expect(logs).toEqual(['heads up']);
      await client.close();
    });

    it('delivers resource updates to a subscribed session', async () => {
      const { client } = await connect(url, 'legacy');
      const updated = new Promise<string>((resolve) =>
        client.setNotificationHandler('notifications/resources/updated', (n) =>
          resolve(n.params.uri),
        ),
      );
      await client.subscribeResource({ uri: 'app://config' });

      app.get(McpToolRegistry).notifyResourceUpdated('app://config');

      await expect(updated).resolves.toBe('app://config');
      await client.close();
    });
  });
  it.each(['auto', 'legacy'] as const)(
    'advertises extra capabilities to a client negotiating %s, but not over the ones it builds',
    async (mode) => {
      jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
      const { app, url } = await startApp({
        session: {},
        capabilities: {
          experimental: { 'example/feature': {} },
          // Not in the type, and ignored: the module sends tools/list_changed regardless.
          ...({ tools: { listChanged: false } } as object),
        },
      });
      const { client } = await connect(url, mode);

      expect(client.getServerCapabilities()).toMatchObject({
        experimental: { 'example/feature': {} },
        tools: { listChanged: true },
      });
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Ignoring capabilities.tools'),
      );
      await client.close();
      await app.close();
    },
  );
});
