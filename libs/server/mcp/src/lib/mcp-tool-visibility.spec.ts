import { Logger } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/server';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-scope-guard';
import { markMcpAuthInfoResolved } from './mcp-resolved-auth-info';
import { wireRegistryToServer } from './wire-registry-to-server';
import type { McpAuthInfo } from './mcp-auth-info';

class AdminScopeGuard extends McpScopeGuard {}

function auth(...scopes: string[]): McpAuthInfo {
  return { token: 't', clientId: 'c', scopes };
}

function buildRegistry(): McpToolRegistry {
  const registry = new McpToolRegistry();
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

function visibleNames(
  visible: { has(name: string): boolean } | undefined,
): string[] {
  return ['public', 'admin', 'admin-write'].filter(
    (name) => !visible || visible.has(name),
  );
}

describe('per-caller tool visibility in McpToolRegistry', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  it('has no rules by default, so every caller sees every tool', async () => {
    const registry = buildRegistry();
    expect(registry.hasToolVisibilityRules()).toBe(false);
    await expect(registry.resolveVisibleTools(auth())).resolves.toBeUndefined();
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

  it("with 'authorized', lists a scoped tool only to a caller with all its scopes", async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });

    expect(visibleNames(await registry.resolveVisibleTools(undefined))).toEqual(
      ['public'],
    );
    expect(
      visibleNames(await registry.resolveVisibleTools(auth('admin'))),
    ).toEqual(['public', 'admin']);
    expect(
      visibleNames(await registry.resolveVisibleTools(auth('admin', 'write'))),
    ).toEqual(['public', 'admin', 'admin-write']);
  });

  it('decides on the auth the strategy resolves, as a guard would see it', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const resolveAuth = jest.fn(async (info?: McpAuthInfo) => ({
      ...info!,
      scopes: [...info!.scopes, 'admin'],
    }));
    registry.setAuthStrategy({ resolveAuth });

    expect(visibleNames(await registry.resolveVisibleTools(auth()))).toEqual([
      'public',
      'admin',
    ]);
    expect(resolveAuth).toHaveBeenCalledTimes(1);

    // Auth an in-process caller already resolved skips the strategy.
    resolveAuth.mockClear();
    const resolved = markMcpAuthInfoResolved(auth());
    expect(visibleNames(await registry.resolveVisibleTools(resolved))).toEqual([
      'public',
    ]);
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

    expect(
      visibleNames(await registry.resolveVisibleTools(auth('admin'))),
    ).toEqual(['public']);
    expect(toolFilter).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'public' }),
      undefined,
    );
  });

  it("applies toolFilter alone with 'all', and on top of the scope rule with 'authorized'", async () => {
    const registry = buildRegistry();
    const toolFilter = (tool: { name: string }) => tool.name !== 'public';

    registry.setToolVisibility({ toolFilter });
    expect(visibleNames(await registry.resolveVisibleTools(auth()))).toEqual([
      'admin',
      'admin-write',
    ]);

    registry.setToolVisibility({ toolVisibility: 'authorized', toolFilter });
    expect(
      visibleNames(await registry.resolveVisibleTools(auth('admin'))),
    ).toEqual(['admin']);
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

    expect(visibleNames(await registry.resolveVisibleTools(auth()))).toEqual([
      'public',
      'admin-write',
    ]);
  });

  it('evaluates a tool registered later once', async () => {
    const registry = buildRegistry();
    const toolFilter = jest.fn(() => true);
    registry.setToolVisibility({ toolFilter });
    const visible = (await registry.resolveVisibleTools(auth()))!;
    registry.registerTool({ name: 'late', description: 'l' }, async () => 'l');

    expect(visible.has('late')).toBe(false);
    await expect(visible.evaluate('late')).resolves.toBe(true);
    await expect(visible.evaluate('late')).resolves.toBe(true);
    expect(visible.has('late')).toBe(true);
    expect(
      toolFilter.mock.calls.filter(([tool]: any) => tool.name === 'late'),
    ).toHaveLength(1);
  });

  it('rejects an unknown toolVisibility', () => {
    const registry = buildRegistry();
    expect(() =>
      registry.setToolVisibility({ toolVisibility: 'none' as any }),
    ).toThrow(/toolVisibility must be 'all' or 'authorized'/);
  });
});

describe('wireRegistryToServer with visibleTools', () => {
  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => jest.restoreAllMocks());

  function registered(server: McpServer): string[] {
    return Object.keys((server as any)._registeredTools).sort();
  }

  async function settle() {
    await new Promise((resolve) => setImmediate(resolve));
  }

  it('registers only the visible tools, and later ones once found visible', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const visibleTools = await registry.resolveVisibleTools(auth());
    const server = new McpServer({ name: 's', version: '1' });

    const unwire = wireRegistryToServer(registry, server, { visibleTools });
    expect(registered(server)).toEqual(['public']);

    registry.registerTool({ name: 'late', description: 'l' }, async () => 'l');
    registry.registerTool(
      { name: 'late-admin', description: 'la' },
      async () => 'la',
      [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
    );
    await settle();
    expect(registered(server)).toEqual(['late', 'public']);

    unwire();
    registry.registerTool(
      { name: 'after-unwire', description: 'u' },
      async () => 'u',
    );
    await settle();
    expect(registered(server)).toEqual(['late', 'public']);
  });

  it('keeps setToolEnabled working for the tools it registered, and ignores hidden ones', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const server = new McpServer({ name: 's', version: '1' });
    wireRegistryToServer(registry, server, {
      visibleTools: await registry.resolveVisibleTools(auth()),
    });
    const tools = (server as any)._registeredTools;

    registry.setToolEnabled('public', false);
    expect(tools['public'].enabled).toBe(false);
    registry.setToolEnabled('admin', false);
    registry.setToolEnabled('admin', true);
    expect(tools['admin']).toBeUndefined();
    registry.setToolEnabled('public', true);
    expect(tools['public'].enabled).toBe(true);
  });

  it('applies a new set of visible tools with setVisibleTools, until it is unwired', async () => {
    const registry = buildRegistry();
    registry.setToolVisibility({ toolVisibility: 'authorized' });
    const server = new McpServer({ name: 's', version: '1' });
    const wiring = wireRegistryToServer(registry, server, {
      visibleTools: await registry.resolveVisibleTools(auth()),
    });
    expect(registered(server)).toEqual(['public']);

    wiring.setVisibleTools(await registry.resolveVisibleTools(auth('admin')));
    expect(registered(server)).toEqual(['admin', 'public']);

    // Later registrations and setToolEnabled follow the latest set.
    registry.registerTool(
      { name: 'late-admin', description: 'la' },
      async () => 'la',
      [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
    );
    await settle();
    expect(registered(server)).toEqual(['admin', 'late-admin', 'public']);
    registry.setToolEnabled('admin', false);
    expect((server as any)._registeredTools['admin'].enabled).toBe(false);

    wiring.setVisibleTools(await registry.resolveVisibleTools(auth()));
    await settle();
    expect(registered(server)).toEqual(['public']);

    wiring.setVisibleTools(undefined);
    expect(registered(server)).toEqual([
      'admin',
      'admin-write',
      'late-admin',
      'public',
    ]);
    expect((server as any)._registeredTools['admin'].enabled).toBe(false);

    wiring();
    wiring.setVisibleTools(await registry.resolveVisibleTools(auth()));
    expect(registered(server)).toEqual([
      'admin',
      'admin-write',
      'late-admin',
      'public',
    ]);
  });

  it('ignores a decision about a tool made for a set that has since been replaced', async () => {
    const registry = buildRegistry();
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => (release = resolve));
    registry.setToolVisibility({
      toolFilter: async (tool, authInfo) => {
        if (tool.name === 'late' && !authInfo?.scopes.includes('admin')) {
          await blocked;
          return true;
        }
        return tool.name !== 'late';
      },
    });
    const server = new McpServer({ name: 's', version: '1' });
    const wiring = wireRegistryToServer(registry, server, {
      visibleTools: await registry.resolveVisibleTools(auth()),
    });

    // Decided for the first set only after the second replaced it: dropped.
    registry.registerTool({ name: 'late', description: 'l' }, async () => 'l');
    wiring.setVisibleTools(await registry.resolveVisibleTools(auth('admin')));
    release();
    await settle();
    await settle();
    expect(registered(server)).not.toContain('late');
  });
});
