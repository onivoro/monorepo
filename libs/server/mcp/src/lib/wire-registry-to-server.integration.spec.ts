import { Logger } from '@nestjs/common';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { buildCapabilities } from './build-capabilities';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpToolError } from './mcp-tool-error';
import type { McpToolVisibilityOptions } from './mcp-tool-visibility';
import {
  wireRegistryToServer,
  WireRegistryToServerOptions,
} from './wire-registry-to-server';

/**
 * Wires the registry onto a real SDK server and connects a real client to it, in memory.
 * In-memory pairs speak the 2025 protocol; mcp-http.e2e.spec covers 2026-07-28.
 */
async function connect(
  registry: McpToolRegistry,
  options: WireRegistryToServerOptions & {
    clientCapabilities?: Record<string, unknown>;
  } = {},
) {
  const server = new McpServer(
    { name: 'test', version: '1.0.0' },
    {
      capabilities: buildCapabilities(registry, {
        logging: options.requestScopedMessages !== false,
        notifications: options.unsolicitedMessages !== false,
      }),
    },
  );
  wireRegistryToServer(registry, server, options);

  const client = new Client(
    { name: 'client', version: '1.0.0' },
    {
      capabilities: options.clientCapabilities ?? {},
      versionNegotiation: { mode: 'legacy' },
    },
  );
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await Promise.all([
    server.connect(serverTransport),
    client.connect(clientTransport),
  ]);
  return { server, client };
}

// With visibility rules set, the module's own tools/list and tools/call handlers serve the
// tools instead of the SDK's; everything here must behave the same through them.
describe.each([
  ['', undefined],
  [', with tool visibility rules', { toolFilter: () => true }],
] as Array<[string, McpToolVisibilityOptions | undefined]>)(
  'wireRegistryToServer against the MCP SDK%s',
  (_label, visibility) => {
    let registry: McpToolRegistry;

    beforeEach(() => {
      jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
      jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
      registry = new McpToolRegistry();
      if (visibility) registry.setToolVisibility(visibility);
    });

    afterEach(() => jest.restoreAllMocks());

    it('completes prompt arguments through the completeStrategy', async () => {
      class LanguageCompleter {
        complete(argName: string, value: string) {
          return argName === 'language'
            ? ['typescript', 'python', 'rust'].filter((l) =>
                l.startsWith(value),
              )
            : [];
        }
      }
      registry.setProviderResolver(() => new LanguageCompleter());
      registry.registerPrompt(
        {
          name: 'generate-code',
          description: 'Generate code',
          argsSchema: { language: z.string(), task: z.string() },
          completeStrategy: LanguageCompleter,
        },
        async () => 'prompt',
      );

      const { client } = await connect(registry);

      expect(client.getServerCapabilities()?.completions).toEqual({});
      const result = await client.complete({
        ref: { type: 'ref/prompt', name: 'generate-code' },
        argument: { name: 'language', value: 'py' },
      });
      expect(result.completion.values).toEqual(['python']);
    });

    it('delivers progress and honors the log level the client sets', async () => {
      registry.registerTool(
        { name: 'work', description: 'd' },
        async (_params: unknown, ctx?: any) => {
          await ctx.sendProgress(1, 2, 'half');
          await ctx.sendLog('debug', 'noise');
          await ctx.sendLog('warning', 'heads up');
          return 'done';
        },
      );

      const { client } = await connect(registry);
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

      expect(result).toEqual({ content: [{ type: 'text', text: 'done' }] });
      expect(progress).toEqual([{ progress: 1, total: 2, message: 'half' }]);
      expect(logs).toEqual(['heads up']);
    });

    it('sends sampling requests to a client that declared sampling', async () => {
      registry.registerTool(
        { name: 'ask', description: 'd' },
        async (_params: unknown, ctx?: any) => {
          const reply = await ctx.createMessage({
            messages: [{ role: 'user', content: { type: 'text', text: 'hi' } }],
            maxTokens: 5,
          });
          return reply.content.text;
        },
      );

      const { client } = await connect(registry, {
        clientCapabilities: { sampling: {} },
      });
      client.setRequestHandler('sampling/createMessage', async () => ({
        role: 'assistant',
        model: 'm',
        content: { type: 'text', text: 'hello back' },
      }));

      const result = await client.callTool({ name: 'ask', arguments: {} });
      expect(result.content).toEqual([{ type: 'text', text: 'hello back' }]);
    });

    it('returns a plain object from a tool with an output schema as structured content', async () => {
      registry.registerTool(
        {
          name: 'count',
          description: 'd',
          outputSchema: z.object({ count: z.number() }),
        },
        async () => ({ count: 3 }),
      );

      const { client } = await connect(registry);
      const result = await client.callTool({ name: 'count', arguments: {} });

      expect(result.isError).toBeFalsy();
      expect(result.structuredContent).toEqual({ count: 3 });
    });

    it('advertises tool and resource _meta, as MCP Apps links a tool to its view', async () => {
      const uri = 'ui://app/view.html';
      registry.registerTool(
        {
          name: 'show',
          description: 'd',
          _meta: { ui: { resourceUri: uri } },
        },
        async () => 'shown',
      );
      registry.registerResource(
        {
          name: 'view',
          uri,
          mimeType: 'text/html;profile=mcp-app',
          _meta: { ui: { prefersBorder: true } },
        },
        async () => ({
          contents: [
            {
              uri,
              mimeType: 'text/html;profile=mcp-app',
              text: '<p>view</p>',
              _meta: { ui: { csp: { resourceDomains: [] } } },
            },
          ],
        }),
      );

      const { client } = await connect(registry);
      const { tools } = await client.listTools();
      const { resources } = await client.listResources();
      const read = await client.readResource({ uri });

      expect(tools.find((tool) => tool.name === 'show')?._meta).toEqual({
        ui: { resourceUri: uri },
      });
      expect(resources.find((r) => r.uri === uri)?._meta).toEqual({
        ui: { prefersBorder: true },
      });
      expect(read.contents[0]._meta).toEqual({
        ui: { csp: { resourceDomains: [] } },
      });
    });

    it('shows the client messages written for it, and hides others when exposeErrorMessages is off', async () => {
      registry.setExposeErrorMessages(false);
      registry.registerTool({ name: 'safe', description: 'd' }, async () => {
        throw new McpToolError('No invoice 42');
      });
      registry.registerTool({ name: 'leaky', description: 'd' }, async () => {
        throw new Error('connect ECONNREFUSED 10.0.0.5:5432');
      });
      registry.registerTool(
        {
          name: 'typed',
          description: 'd',
          schema: z.object({ n: z.number() }),
        },
        async () => 'ok',
      );

      const { client } = await connect(registry);

      const safe = await client.callTool({ name: 'safe', arguments: {} });
      const leaky = await client.callTool({ name: 'leaky', arguments: {} });
      const typed = await client.callTool({
        name: 'typed',
        arguments: { n: 'x' },
      });

      expect(safe.content).toEqual([
        { type: 'text', text: 'Error executing safe: No invoice 42' },
      ]);
      expect(leaky.content).toEqual([
        { type: 'text', text: 'Error executing leaky: Internal error' },
      ]);
      expect(typed.isError).toBe(true);
    });

    it('advertises the input schema, and runs guards before validating arguments', async () => {
      class DenyGuard {
        canActivate() {
          return false;
        }
      }
      registry.setGuardResolver(() => new DenyGuard());
      const schema = z.object({ n: z.number() });
      registry.registerTool(
        { name: 'guarded', description: 'd', schema },
        async () => 'ok',
        [{ guardClass: DenyGuard }],
      );

      const { client } = await connect(registry);
      const tools = await client.listTools();
      const result = await client.callTool({
        name: 'guarded',
        arguments: { n: 'not a number' },
      });

      expect(tools.tools[0].inputSchema).toEqual(
        expect.objectContaining({
          type: 'object',
          properties: { n: { type: 'number' } },
          required: ['n'],
        }),
      );
      // Denied before validation: the caller doesn't learn about the schema.
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Error executing guarded: Access denied by DenyGuard for tool "guarded".',
        },
      ]);
    });

    it('applies transforms once', async () => {
      const seen: unknown[] = [];
      registry.registerTool(
        {
          name: 'double',
          description: 'd',
          schema: z.object({ n: z.number().transform((n) => n * 2) }),
        },
        async (params: any) => {
          seen.push(params.n);
          return 'ok';
        },
      );

      const { client } = await connect(registry);
      await client.callTool({ name: 'double', arguments: { n: 2 } });

      expect(seen).toEqual([4]);
    });

    it('passes auth and request context to a tool without an input schema', async () => {
      let seen: any;
      registry.registerTool(
        { name: 'bare', description: 'd' },
        async (params: unknown, ctx?: any) => {
          seen = { params, signal: ctx.signal };
          return 'ok';
        },
      );

      const { client } = await connect(registry);
      await client.callTool({ name: 'bare', arguments: { anything: 1 } });

      expect(seen.params).toEqual({ anything: 1 });
      expect(seen.signal).toBeInstanceOf(AbortSignal);
    });

    it("lists a template's _meta, and lets a listed resource's own _meta replace it", async () => {
      class ItemList {
        list() {
          return {
            resources: [
              { uri: 'app://items/1', name: 'Item 1' },
              { uri: 'app://items/2', name: 'Item 2', _meta: { own: true } },
            ],
          };
        }
      }
      registry.setProviderResolver(() => new ItemList());
      registry.registerResource(
        {
          name: 'item',
          uri: 'app://items/{id}',
          isTemplate: true,
          listStrategy: ItemList as any,
          _meta: { shared: true },
        },
        async () => 'item',
      );
      registry.registerPrompt(
        { name: 'report', _meta: { 'acme/kind': 'report' } },
        async () => 'prompt',
      );

      const { client } = await connect(registry);
      const { resourceTemplates } = await client.listResourceTemplates();
      const { resources } = await client.listResources();
      const { prompts } = await client.listPrompts();

      expect(resourceTemplates[0]._meta).toEqual({ shared: true });
      expect(resources.map((r) => r._meta)).toEqual([
        { shared: true },
        { own: true },
      ]);
      expect(prompts[0]._meta).toEqual({ 'acme/kind': 'report' });
    });

    it("passes resource and prompt handlers the library context, not the SDK's", async () => {
      const seen: Record<string, any> = {};
      registry.registerResource(
        { name: 'static', uri: 'app://static' },
        async (_uri: URL, ctx: any) => {
          seen['static'] = ctx;
          return 'data';
        },
      );
      registry.registerResource(
        { name: 'item', uri: 'app://items/{id}', isTemplate: true },
        async (_uri: URL, variables: any, ctx: any) => {
          seen['template'] = { variables, ctx };
          return 'item';
        },
      );
      registry.registerPrompt(
        { name: 'with-args', argsSchema: { topic: z.string() } },
        async (args: any, ctx: any) => {
          seen['withArgs'] = { args, ctx };
          return 'prompt';
        },
      );
      registry.registerPrompt({ name: 'no-args' }, async (ctx: any) => {
        seen['noArgs'] = ctx;
        return 'prompt';
      });

      const { client } = await connect(registry);
      await client.readResource({ uri: 'app://static' });
      await client.readResource({ uri: 'app://items/7' });
      await client.getPrompt({
        name: 'with-args',
        arguments: { topic: 'mcp' },
      });
      await client.getPrompt({ name: 'no-args' });

      const libraryContext = {
        era: 'legacy',
        signal: expect.any(AbortSignal),
        requestState: expect.any(Function),
      };
      expect(seen['static']).toEqual(libraryContext);
      expect(seen['template']).toEqual({
        variables: { id: '7' },
        ctx: libraryContext,
      });
      expect(seen['withArgs']).toEqual({
        args: { topic: 'mcp' },
        ctx: libraryContext,
      });
      expect(seen['noArgs']).toEqual(libraryContext);
      // None of the SDK's own context leaks through.
      expect(seen['static']).not.toHaveProperty('mcpReq');
    });

    it('advertises no list changes or subscriptions without a stream for them', async () => {
      registry.registerTool({ name: 't', description: 'd' }, async () => 'ok');
      registry.registerResource(
        { name: 'r', uri: 'app://r' },
        async () => 'data',
      );

      const { client } = await connect(registry, {
        unsolicitedMessages: false,
      });

      expect(client.getServerCapabilities()).toEqual(
        expect.objectContaining({
          tools: { listChanged: false },
          resources: { subscribe: false, listChanged: false },
        }),
      );
    });
  },
);
