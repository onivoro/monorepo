import { Logger } from '@nestjs/common';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpCanActivate } from './mcp-can-activate';

class SomeGuard implements McpCanActivate {
  canActivate() {
    return true;
  }
}

class SomeProvider {
  value = 42;
}

describe('McpToolRegistry provider and guard resolution', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    registry = new McpToolRegistry();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('resolveProvider', () => {
    it('should throw when no provider resolver has been set', () => {
      expect(() => registry.resolveProvider(SomeProvider)).toThrow(
        /No provider resolver set/,
      );
    });

    it('should delegate to the configured resolver', () => {
      const instance = new SomeProvider();
      const resolver = jest.fn().mockReturnValue(instance);
      registry.setProviderResolver(resolver);

      expect(registry.resolveProvider(SomeProvider)).toBe(instance);
      expect(resolver).toHaveBeenCalledWith(SomeProvider);
    });
  });

  describe('getToolGuards', () => {
    it('should return an empty array for an unknown tool', () => {
      expect(registry.getToolGuards('missing')).toEqual([]);
    });

    it('should return an empty array for a tool registered without guards', () => {
      registry.registerTool({ name: 'plain', description: 'd' }, jest.fn());
      expect(registry.getToolGuards('plain')).toEqual([]);
    });

    it('should return the guards a tool was registered with', () => {
      const guards = [{ guardClass: SomeGuard, config: { scopes: ['x'] } }];
      registry.registerTool(
        { name: 'guarded', description: 'd' },
        jest.fn(),
        guards,
      );
      expect(registry.getToolGuards('guarded')).toEqual(guards);
    });
  });
});
