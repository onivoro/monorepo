import { McpScopeRegistry } from './mcp-scope-registry';
import { McpToolRegistry, McpScopeGuard } from '@onivoro/server-mcp';

describe('McpScopeRegistry edge cases', () => {
  it('returns empty results when constructed without a tool registry', () => {
    const scopeRegistry = new McpScopeRegistry();

    scopeRegistry.onModuleInit();

    expect(scopeRegistry.getScopesArray()).toEqual([]);
    expect(scopeRegistry.getScopes().size).toBe(0);
  });

  it('ignores McpScopeGuard entries without a config or scopes', () => {
    const registry = new McpToolRegistry();
    registry.registerTool({ name: 'no-config', description: 'x' }, jest.fn(), [
      { guardClass: McpScopeGuard },
    ]);
    registry.registerTool({ name: 'no-scopes', description: 'x' }, jest.fn(), [
      { guardClass: McpScopeGuard, config: {} },
    ]);
    const scopeRegistry = new McpScopeRegistry(registry);

    scopeRegistry.onModuleInit();

    expect(scopeRegistry.getScopesArray()).toEqual([]);
  });

  it('ignores non-tool registration changes', () => {
    const registry = new McpToolRegistry();
    const scopeRegistry = new McpScopeRegistry(registry);
    const getToolGuards = jest.spyOn(registry, 'getToolGuards');
    scopeRegistry.onModuleInit();

    registry.registerResource({ name: 'res', uri: 'app://res' }, jest.fn());
    registry.registerPrompt({ name: 'prompt' }, jest.fn());

    expect(getToolGuards).not.toHaveBeenCalled();
    expect(scopeRegistry.getScopesArray()).toEqual([]);
  });

  it('collects scopes from multiple scope guards on the same tool and sorts them', () => {
    const registry = new McpToolRegistry();
    const scopeRegistry = new McpScopeRegistry(registry);
    scopeRegistry.onModuleInit();

    registry.registerTool({ name: 'multi', description: 'x' }, jest.fn(), [
      { guardClass: McpScopeGuard, config: { scopes: ['z:write'] } },
      { guardClass: McpScopeGuard, config: { scopes: ['a:read', 'z:write'] } },
    ]);

    expect(scopeRegistry.getScopesArray()).toEqual(['a:read', 'z:write']);
  });
});
