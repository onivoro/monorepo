import { Logger } from '@nestjs/common';
import { Client, InMemoryTransport } from '@modelcontextprotocol/client';
import { McpServer } from '@modelcontextprotocol/server';
import { buildCapabilities } from './build-capabilities';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-scope-guard';
import { markMcpAuthInfoResolved } from './mcp-resolved-auth-info';
import { wireRegistryToServer } from './wire-registry-to-server';
import type { McpAuthInfo } from './mcp-auth-info';

class AdminScopeGuard extends McpScopeGuard {}

const ALL = ['public', 'admin', 'admin-write'];

function auth(...scopes: string[]): McpAuthInfo {
  return { token: 't', clientId: 'c', scopes };
}

function buildRegistry(): McpToolRegistry {
  const registry = new McpToolRegistry();
  registry.setGuardResolver(() => new McpScopeGuard());
  registry.registerTool({ name: 'public', description: 'p' }, async () => 'p');
  registry.registerTool({ name: 'admin', description: 'a' }, async () => 'a', [
    { guardClass: McpScopeGuard, config: { scopes: ['admin'] } },
  ]);
  registry.registerTool(
    { name: 'admin-write', description: 'aw' },
    async () => 'aw',
    [
      { guardClass: AdminScopeGuard, config: { scopes: ['admin'] } },
      { guardClass: McpScopeGuard, config: { scopes: ['write', 'admin'] } },
    ],
  );
  return registry;
}

async function visibleNames(
  registry: McpToolRegistry,
  authInfo: McpAuthInfo | undefined,
  names = ALL,
): Promise<string[]> {
  const isVisible = await registry.resolveToolVisibility(authInfo);
  if (!isVisible) return names;
  const decisions = await Promise.all(names.map((name) => isVisible(name)));
  return names.filter((_, i) => decisions[i]);
}

describe('per-caller tool visibility in McpToolRegistry', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('has no rules by default, so every caller sees every tool', async () => {
    const registry = buildRegistry();
    expect(registry.hasToolVisibilityRules()).toBe(false);
    await expect(
      registry.resolveToolVisibility(auth()),
    ).resolves.toBeUndefined();
  });

  it('collects the scopes of McpScopeGuard guards and their subclasses', () => {
    const registry = buildRegistry();
    expect(registry.getToolRequiredScopes('admin-write')).toEqual([
      'admin',
      'write',
    ]);
    expect(registry.getToolRequiredScopes('public')).toEqual([]);
    expect(registry.getToolRequiredScopes('missing')).toEqual([]);
  });

  it("with 'authorized', shows a scoped tool only to a caller with all its scopes", async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });

    expect(await visibleNames(registry, undefined)).toEqual(['public']);
    expect(await visibleNames(registry, auth('admin'))).toEqual([
      'public',
      'admin',
    ]);
    expect(await visibleNames(registry, auth('admin', 'write'))).toEqual(ALL);
    expect(await visibleNames(registry, auth(), ['missing'])).toEqual([]);
  });

  it('decides on the auth the strategy resolves, once per resolution', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const resolveAuth = jest.fn(async (info?: McpAuthInfo) => ({
      ...info!,
      scopes: [...info!.scopes, 'admin'],
    }));
    registry.setAuthStrategy({ resolveAuth });

    expect(await visibleNames(registry, auth())).toEqual(['public', 'admin']);
    expect(resolveAuth).toHaveBeenCalledTimes(1);

    // Auth an in-process caller already resolved skips the strategy.
    resolveAuth.mockClear();
    expect(
      await visibleNames(registry, markMcpAuthInfoResolved(auth())),
    ).toEqual(['public']);
    expect(resolveAuth).not.toHaveBeenCalled();
  });

  it('treats a caller whose auth the strategy rejects as unauthenticated', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const registry = buildRegistry();
    const toolFilter = jest.fn(() => true);
    registry.setToolVisibility({ toolVisibility: 'authorized', toolFilter });
    registry.setAuthStrategy({
      resolveAuth: async () => {
        throw new Error('expired');
      },
    });

    expect(await visibleNames(registry, auth('admin'))).toEqual(['public']);
    expect(toolFilter).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'public' }),
      undefined,
    );
  });

  it("applies toolFilter alone with 'all', and on top of the scope rule with 'authorized'", async () => {
    const registry = buildRegistry();
    const toolFilter = (tool: { name: string }) => tool.name !== 'public';

    registry.setToolVisibility({ toolFilter });
    expect(await visibleNames(registry, auth())).toEqual([
      'admin',
      'admin-write',
    ]);

    registry.setToolVisibility({ toolVisibility: 'authorized', toolFilter });
    expect(await visibleNames(registry, auth('admin'))).toEqual(['admin']);
  });

  it('hides a tool whose filter throws or rejects', async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const registry = buildRegistry();
    registry.setToolVisibility({
      toolFilter: async (tool) => {
        if (tool.name === 'admin') throw new Error('boom');
        return true;
      },
    });

    expect(await visibleNames(registry, auth())).toEqual([
      'public',
      'admin-write',
    ]);
  });

  it('decides each tool once per resolution, including tools registered after it', async () => {
    const registry = buildRegistry();
    const toolFilter = jest.fn(() => true);
    registry.setToolVisibility({ toolFilter });
    const isVisible = (await registry.resolveToolVisibility(auth()))!;
    registry.registerTool({ name: 'late', description: 'l' }, async () => 'l');

    await expect(isVisible('late')).resolves.toBe(true);
    await expect(isVisible('late')).resolves.toBe(true);
    expect(toolFilter).toHaveBeenCalledTimes(1);
  });

  it('rejects an unknown toolVisibility', () => {
    const registry = buildRegistry();
    expect(() =>
      registry.setToolVisibility({ toolVisibility: 'none' as any }),
    ).toThrow(/toolVisibility must be 'all' or 'authorized'/);
  });
});

describe('wireRegistryToServer with visibility rules', () => {
  // In memory, requests carry no auth: the strategy decides who calls, from `scopes`.
  let scopes: string[];
  let resolveAuth: jest.Mock;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    scopes = [];
    resolveAuth = jest.fn(async () => auth(...scopes));
  });

  afterEach(() => jest.restoreAllMocks());

  async function connect(
    registry: McpToolRegistry,
    capabilities = buildCapabilities(registry),
  ) {
    registry.setAuthStrategy({ resolveAuth });
    const server = new McpServer({ name: 's', version: '1' }, { capabilities });
    const unwire = wireRegistryToServer(registry, server);
    const client = new Client(
      { name: 'c', version: '1' },
      { versionNegotiation: { mode: 'legacy' } },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    return { server, client, unwire };
  }

  async function names(client: Client) {
    return (await client.listTools()).tools.map((tool) => tool.name).sort();
  }

  it('registers every tool, and lists and calls each request may see by its own auth', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const { server, client } = await connect(registry);

    expect(Object.keys((server as any)._registeredTools).sort()).toEqual([
      'admin',
      'admin-write',
      'public',
    ]);
    expect(await names(client)).toEqual(['public']);
    await expect(
      client.callTool({ name: 'admin', arguments: {} }),
    ).rejects.toThrow(/Tool admin not found/);

    scopes = ['admin'];
    expect(await names(client)).toEqual(['admin', 'public']);
    const result: any = await client.callTool({ name: 'admin', arguments: {} });
    expect(result.content[0].text).toBe('a');

    scopes = [];
    expect(await names(client)).toEqual(['public']);
    await expect(
      client.callTool({ name: 'admin', arguments: {} }),
    ).rejects.toThrow(/Tool admin not found/);
  });

  it('resolves the auth once per tools/list, and once per tools/call to decide visibility', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const { client } = await connect(registry);

    resolveAuth.mockClear();
    await client.listTools();
    expect(resolveAuth).toHaveBeenCalledTimes(1);

    resolveAuth.mockClear();
    await client.callTool({ name: 'public', arguments: {} });
    // Once for visibility, once more by the registry for the guards.
    expect(resolveAuth).toHaveBeenCalledTimes(2);
  });

  it('keeps disabled tools hidden and refused for everyone, and shows enabled ones only to callers who may see them', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const { client } = await connect(registry);
    scopes = ['admin'];

    registry.setToolEnabled('admin', false);
    expect(await names(client)).toEqual(['public']);
    // A caller who may see the tool learns it is disabled...
    await expect(
      client.callTool({ name: 'admin', arguments: {} }),
    ).rejects.toThrow(/Tool admin disabled/);
    // ...one who may not isn't told it exists.
    scopes = [];
    await expect(
      client.callTool({ name: 'admin', arguments: {} }),
    ).rejects.toThrow(/Tool admin not found/);
    scopes = ['admin'];

    registry.setToolEnabled('admin', true);
    expect(await names(client)).toEqual(['admin', 'public']);
    scopes = [];
    expect(await names(client)).toEqual(['public']);
  });

  it("applies the server's maxToolInputElements exactly as the SDK does without rules", async () => {
    const call = async (rules: boolean) => {
      const registry = buildRegistry();
      if (rules) registry.setToolVisibility({ toolFilter: () => true });
      registry.setAuthStrategy({ resolveAuth });
      const server = new McpServer(
        { name: 's', version: '1' },
        { capabilities: buildCapabilities(registry), maxToolInputElements: 3 },
      );
      wireRegistryToServer(registry, server);
      const client = new Client(
        { name: 'c', version: '1' },
        { versionNegotiation: { mode: 'legacy' } },
      );
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      await Promise.all([
        server.connect(serverTransport),
        client.connect(clientTransport),
      ]);
      return client.callTool({
        name: 'public',
        arguments: { items: [1, 2, 3, 4, 5] },
      });
    };

    const withoutRules: any = await call(false);
    expect(withoutRules.isError).toBe(true);
    expect(withoutRules.content[0].text).toMatch(/maximum of 3 elements/);
    expect(await call(true)).toEqual(withoutRules);
  });

  it('lists and serves tools registered on the server outside the registry, as without rules', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const { server, client } = await connect(registry);
    server.registerTool(
      'outside',
      { description: "Not the registry's" },
      async () => ({
        content: [{ type: 'text', text: 'outside' }],
      }),
    );

    expect(await names(client)).toEqual(['outside', 'public']);
    const result: any = await client.callTool({
      name: 'outside',
      arguments: {},
    });
    expect(result.content[0].text).toBe('outside');
  });

  it('serves tools registered later, by the same rules', async () => {
    const registry = new McpToolRegistry();
    registry.setGuardResolver(() => new McpScopeGuard());
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    // No tools yet, so the module's handlers replace the SDK's once the first one is wired.
    const { client } = await connect(registry, {
      tools: { listChanged: true },
    });

    registry.registerTool({ name: 'late', description: 'l' }, async () => 'l');
    registry.registerTool(
      { name: 'late-admin', description: 'la' },
      async () => 'la',
      [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
    );

    expect(await names(client)).toEqual(['late']);
    scopes = ['admin'];
    expect(await names(client)).toEqual(['late', 'late-admin']);
    const result: any = await client.callTool({
      name: 'late-admin',
      arguments: {},
    });
    expect(result.content[0].text).toBe('la');
  });

  it('fails at wiring, even with no tools yet, on a server whose SDK lacks the hooks it needs', () => {
    const registry = new McpToolRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const server = new McpServer({ name: 's', version: '1' });
    (server.server as any)._getRequestHandler = undefined;

    expect(() => wireRegistryToServer(registry, server)).toThrow(
      /does not expose the request handler hooks/,
    );
  });

  it('checks a tool registered later on a server wired with no tools and no tools capability', async () => {
    const registry = new McpToolRegistry();
    registry.setGuardResolver(() => new McpScopeGuard());
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    registry.setAuthStrategy({ resolveAuth });
    const server = new McpServer({ name: 's', version: '1' });
    wireRegistryToServer(registry, server);

    // Registered before connecting: the SDK installs its tool handlers with the first one.
    registry.registerTool({ name: 'late', description: 'l' }, async () => 'l');
    registry.registerTool(
      { name: 'late-admin', description: 'la' },
      async () => 'la',
      [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
    );
    const client = new Client(
      { name: 'c', version: '1' },
      { versionNegotiation: { mode: 'legacy' } },
    );
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);

    expect(await names(client)).toEqual(['late']);
    await expect(
      client.callTool({ name: 'late-admin', arguments: {} }),
    ).rejects.toThrow(/Tool late-admin not found/);
  });

  it('removes a tool rather than serving it unchecked if the check cannot be installed with it', () => {
    const registry = new McpToolRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const server = new McpServer({ name: 's', version: '1' });
    wireRegistryToServer(registry, server);
    // The SDK now has no handlers to check.
    (server.server as any)._getRequestHandler = () => undefined;

    registry.registerTool({ name: 'late', description: 'l' }, async () => 'l');

    expect(Object.keys((server as any)._registeredTools)).toEqual([]);
    expect(Logger.prototype.error).toHaveBeenCalled();
  });

  it("leaves the server's own _wrapHandler in place, still used for handlers installed later", () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const server = new McpServer(
      { name: 's', version: '1' },
      { capabilities: buildCapabilities(registry) },
    );
    const wrap = jest.spyOn(server.server as any, '_wrapHandler');
    wireRegistryToServer(registry, server);

    expect((server.server as any)._wrapHandler).toBe(wrap);
    wrap.mockClear();
    server.registerPrompt('later', { description: 'p' }, async () => ({
      messages: [],
    }));
    expect(wrap).toHaveBeenCalledWith('prompts/get', expect.any(Function));
  });

  it('answers malformed tools/call and tools/list exactly as the SDK does without rules', async () => {
    const errors = async (rules: boolean) => {
      const registry = buildRegistry();
      if (rules) registry.setToolVisibility({ toolVisibility: 'authorized' });
      registry.setAuthStrategy({ resolveAuth });
      const server = new McpServer(
        { name: 's', version: '1' },
        { capabilities: buildCapabilities(registry) },
      );
      wireRegistryToServer(registry, server);
      const [clientTransport, serverTransport] =
        InMemoryTransport.createLinkedPair();
      const responses = new Map<number, any>();
      clientTransport.onmessage = (message: any) => {
        if ('id' in message) responses.set(message.id, message);
      };
      await server.connect(serverTransport);
      await clientTransport.start();
      const send = (message: Record<string, unknown>) =>
        clientTransport.send({ jsonrpc: '2.0', ...message } as any);
      await send({
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'raw', version: '1' },
        },
      });
      await send({ method: 'notifications/initialized' });
      await send({ id: 2, method: 'tools/call', params: { name: 42 } });
      await send({ id: 3, method: 'tools/list', params: { cursor: 5 } });
      for (let i = 0; i < 50 && responses.size < 3; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5));
      }
      return [responses.get(2), responses.get(3)];
    };

    const without = await errors(false);
    expect(without[0].error.code).toBe(-32602);
    expect(without[1].error).toBeDefined();
    expect(await errors(true)).toEqual(without);
  });
});
