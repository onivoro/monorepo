import { McpScopeRegistry } from './mcp-scope-registry';
import { McpToolRegistry, McpScopeGuard } from '@onivoro/server-mcp';

describe('McpScopeRegistry', () => {
  let registry: McpToolRegistry;
  let scopeRegistry: McpScopeRegistry;

  beforeEach(() => {
    registry = new McpToolRegistry();
    scopeRegistry = new McpScopeRegistry(registry);
  });

  it('should collect scopes from tools registered before init', () => {
    registry.registerTool(
      { name: 'tool-a', description: 'A' },
      jest.fn(),
      [{ guardClass: McpScopeGuard, config: { scopes: ['read', 'write'] } }],
    );
    registry.registerTool(
      { name: 'tool-b', description: 'B' },
      jest.fn(),
      [{ guardClass: McpScopeGuard, config: { scopes: ['admin'] } }],
    );

    scopeRegistry.onModuleInit();

    expect(scopeRegistry.getScopesArray()).toEqual(['admin', 'read', 'write']);
  });

  it('should pick up scopes from dynamically registered tools', () => {
    scopeRegistry.onModuleInit();

    expect(scopeRegistry.getScopesArray()).toEqual([]);

    registry.registerTool(
      { name: 'dynamic-tool', description: 'D' },
      jest.fn(),
      [{ guardClass: McpScopeGuard, config: { scopes: ['execute'] } }],
    );

    expect(scopeRegistry.getScopesArray()).toEqual(['execute']);
  });

  it('should deduplicate scopes across tools', () => {
    registry.registerTool(
      { name: 'tool-1', description: 'T1' },
      jest.fn(),
      [{ guardClass: McpScopeGuard, config: { scopes: ['read'] } }],
    );
    registry.registerTool(
      { name: 'tool-2', description: 'T2' },
      jest.fn(),
      [{ guardClass: McpScopeGuard, config: { scopes: ['read', 'write'] } }],
    );

    scopeRegistry.onModuleInit();

    expect(scopeRegistry.getScopesArray()).toEqual(['read', 'write']);
  });

  it('should ignore tools without guards', () => {
    registry.registerTool({ name: 'no-guard', description: 'N' }, jest.fn());

    scopeRegistry.onModuleInit();

    expect(scopeRegistry.getScopesArray()).toEqual([]);
  });

  it('should ignore non-McpScopeGuard guards', () => {
    class CustomGuard {
      canActivate() { return true; }
    }

    registry.registerTool(
      { name: 'custom-guarded', description: 'C' },
      jest.fn(),
      [{ guardClass: CustomGuard as any, config: { scopes: ['should-not-appear'] } }],
    );

    scopeRegistry.onModuleInit();

    expect(scopeRegistry.getScopesArray()).toEqual([]);
  });

  it('should return scopes as a ReadonlySet', () => {
    registry.registerTool(
      { name: 'tool', description: 'T' },
      jest.fn(),
      [{ guardClass: McpScopeGuard, config: { scopes: ['read'] } }],
    );

    scopeRegistry.onModuleInit();

    const set = scopeRegistry.getScopes();
    expect(set.has('read')).toBe(true);
    expect(set.size).toBe(1);
  });
});
