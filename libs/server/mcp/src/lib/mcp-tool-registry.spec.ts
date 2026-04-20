import { McpToolRegistry, McpAuthInfo, McpToolContext, McpToolInterceptor, McpCanActivate, McpGuardMetadata } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-guard';
import { z } from 'zod';

const MOCK_AUTH: McpAuthInfo = {
  token: 'tok_123',
  clientId: 'client-1',
  scopes: ['read', 'write'],
};

describe('McpToolRegistry', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    registry = new McpToolRegistry();
  });

  describe('registerTool', () => {
    it('should register a tool', () => {
      const handler = jest.fn();
      registry.registerTool({ name: 'my-tool', description: 'desc' }, handler);

      expect(registry.hasTool('my-tool')).toBe(true);
      expect(registry.getTools()).toHaveLength(1);
    });

    it('should throw on duplicate tool name', () => {
      registry.registerTool({ name: 'dup', description: 'first' }, jest.fn());
      expect(() =>
        registry.registerTool({ name: 'dup', description: 'second' }, jest.fn()),
      ).toThrow(/already registered/);
    });
  });

  describe('registerResource', () => {
    it('should register a resource', () => {
      registry.registerResource({ name: 'res', uri: 'test://r' }, jest.fn());
      expect(registry.getResources()).toHaveLength(1);
    });

    it('should throw on duplicate resource name', () => {
      registry.registerResource({ name: 'res', uri: 'test://a' }, jest.fn());
      expect(() =>
        registry.registerResource({ name: 'res', uri: 'test://b' }, jest.fn()),
      ).toThrow(/already registered/);
    });
  });

  describe('registerPrompt', () => {
    it('should register a prompt', () => {
      registry.registerPrompt({ name: 'prompt' }, jest.fn());
      expect(registry.getPrompts()).toHaveLength(1);
    });

    it('should throw on duplicate prompt name', () => {
      registry.registerPrompt({ name: 'prompt' }, jest.fn());
      expect(() =>
        registry.registerPrompt({ name: 'prompt' }, jest.fn()),
      ).toThrow(/already registered/);
    });
  });

  describe('executeToolRaw', () => {
    it('should call the raw handler and return its result', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'hello' });
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolRaw('tool', { input: 'x' });

      expect(handler).toHaveBeenCalledWith({ input: 'x' }, expect.objectContaining({ toolName: 'tool' }));
      expect(result).toEqual({ data: 'hello' });
    });

    it('should throw for unknown tool', async () => {
      await expect(registry.executeToolRaw('nope', {})).rejects.toThrow(/not registered/);
    });

    it('should forward authInfo in the context', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      await registry.executeToolRaw('tool', { x: 1 }, MOCK_AUTH);

      const context: McpToolContext = handler.mock.calls[0][1];
      expect(context.authInfo).toEqual(MOCK_AUTH);
      expect(context.toolName).toBe('tool');
      expect(context.params).toEqual({ x: 1 });
    });

    it('should pass undefined authInfo when not provided', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      await registry.executeToolRaw('tool', {});

      const context: McpToolContext = handler.mock.calls[0][1];
      expect(context.authInfo).toBeUndefined();
    });

    it('should validate params against the schema', async () => {
      const schema = z.object({ name: z.string() });
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool({ name: 'tool', description: 'd', schema }, handler);

      await expect(
        registry.executeToolRaw('tool', { name: 123 } as any),
      ).rejects.toThrow();
      expect(handler).not.toHaveBeenCalled();
    });

    it('should pass validated params to the handler', async () => {
      const schema = z.object({ name: z.string(), count: z.number().default(1) });
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool({ name: 'tool', description: 'd', schema }, handler);

      await registry.executeToolRaw('tool', { name: 'test' });

      expect(handler).toHaveBeenCalledWith(
        { name: 'test', count: 1 },
        expect.objectContaining({ params: { name: 'test', count: 1 } }),
      );
    });

    it('should skip validation when no schema is defined', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      await registry.executeToolRaw('tool', { anything: true });
      expect(handler).toHaveBeenCalledWith(
        { anything: true },
        expect.objectContaining({ params: { anything: true } }),
      );
    });
  });

  describe('executeToolWrapped', () => {
    it('should pass through results with content', async () => {
      const handler = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'hello' }],
      });
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolWrapped('tool', {});
      expect(result).toEqual({ content: [{ type: 'text', text: 'hello' }] });
    });

    it('should wrap string results', async () => {
      const handler = jest.fn().mockResolvedValue('plain text');
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolWrapped('tool', {});
      expect(result).toEqual({ content: [{ type: 'text', text: 'plain text' }] });
    });

    it('should stringify object results', async () => {
      const handler = jest.fn().mockResolvedValue({ key: 'value' });
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolWrapped('tool', {});
      expect((result.content[0] as any).text).toContain('"key": "value"');
    });

    it('should catch errors and return error content with isError flag', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('boom'));
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolWrapped('tool', {});
      expect((result.content[0] as any).text).toContain('Error executing tool');
      expect((result.content[0] as any).text).toContain('boom');
      expect(result.isError).toBe(true);
    });

    it('should not set isError on successful results', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolWrapped('tool', {});
      expect(result.isError).toBeUndefined();
    });
  });

  describe('interceptors', () => {
    it('should wrap the handler — before and after logic runs in order', async () => {
      const order: string[] = [];
      const handler = jest.fn().mockImplementation(async () => {
        order.push('handler');
        return 'ok';
      });
      const interceptor: McpToolInterceptor = {
        intercept: jest.fn().mockImplementation(async (ctx, next) => {
          order.push('before');
          const result = await next();
          order.push('after');
          return result;
        }),
      };

      registry.registerInterceptor(interceptor);
      registry.registerTool({ name: 'tool', description: 'd' }, handler);
      await registry.executeToolRaw('tool', {});

      expect(order).toEqual(['before', 'handler', 'after']);
      expect(interceptor.intercept).toHaveBeenCalledWith(
        expect.objectContaining({ toolName: 'tool' }),
        expect.any(Function),
      );
    });

    it('should receive the handler result through the chain', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 42 });
      let capturedResult: unknown;
      const interceptor: McpToolInterceptor = {
        async intercept(ctx, next) {
          const result = await next();
          capturedResult = result;
          return result;
        },
      };

      registry.registerInterceptor(interceptor);
      registry.registerTool({ name: 'tool', description: 'd' }, handler);
      const result = await registry.executeToolRaw('tool', { x: 1 });

      expect(capturedResult).toEqual({ data: 42 });
      expect(result).toEqual({ data: 42 });
    });

    it('should pass authInfo through to interceptors', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      let capturedContext: McpToolContext | undefined;
      const interceptor: McpToolInterceptor = {
        async intercept(ctx, next) {
          capturedContext = ctx;
          return next();
        },
      };

      registry.registerInterceptor(interceptor);
      registry.registerTool({ name: 'tool', description: 'd' }, handler);
      await registry.executeToolRaw('tool', {}, MOCK_AUTH);

      expect(capturedContext?.authInfo).toEqual(MOCK_AUTH);
    });

    it('should abort execution when an interceptor throws before next()', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      const interceptor: McpToolInterceptor = {
        async intercept() {
          throw new Error('unauthorized');
        },
      };

      registry.registerInterceptor(interceptor);
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      await expect(registry.executeToolRaw('tool', {})).rejects.toThrow('unauthorized');
      expect(handler).not.toHaveBeenCalled();
    });

    it('should allow interceptors to transform the result', async () => {
      const handler = jest.fn().mockResolvedValue({ count: 1 });
      const interceptor: McpToolInterceptor = {
        async intercept(ctx, next) {
          const result = await next() as Record<string, unknown>;
          return { ...result, intercepted: true };
        },
      };

      registry.registerInterceptor(interceptor);
      registry.registerTool({ name: 'tool', description: 'd' }, handler);
      const result = await registry.executeToolRaw('tool', {});

      expect(result).toEqual({ count: 1, intercepted: true });
    });

    it('should chain multiple interceptors in registration order (onion model)', async () => {
      const order: string[] = [];
      const handler = jest.fn().mockImplementation(async () => {
        order.push('handler');
        return 'ok';
      });

      registry.registerInterceptor({
        async intercept(ctx, next) {
          order.push('i1-before');
          const result = await next();
          order.push('i1-after');
          return result;
        },
      });
      registry.registerInterceptor({
        async intercept(ctx, next) {
          order.push('i2-before');
          const result = await next();
          order.push('i2-after');
          return result;
        },
      });

      registry.registerTool({ name: 'tool', description: 'd' }, handler);
      await registry.executeToolRaw('tool', {});

      expect(order).toEqual(['i1-before', 'i2-before', 'handler', 'i2-after', 'i1-after']);
    });

    it('should short-circuit the chain when an interceptor does not call next()', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      const interceptor: McpToolInterceptor = {
        async intercept() {
          return 'short-circuited';
        },
      };

      registry.registerInterceptor(interceptor);
      registry.registerTool({ name: 'tool', description: 'd' }, handler);
      const result = await registry.executeToolRaw('tool', {});

      expect(result).toBe('short-circuited');
      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe('guards', () => {
    class AllowGuard implements McpCanActivate {
      canActivate() { return true; }
    }

    class DenyGuard implements McpCanActivate {
      canActivate() { return false; }
    }

    class AsyncDenyGuard implements McpCanActivate {
      async canActivate() { return false; }
    }

    const scopeGuard = new McpScopeGuard();

    function withResolver() {
      const instances = new Map<any, McpCanActivate>();
      instances.set(AllowGuard, new AllowGuard());
      instances.set(DenyGuard, new DenyGuard());
      instances.set(AsyncDenyGuard, new AsyncDenyGuard());
      instances.set(McpScopeGuard, scopeGuard);
      registry.setGuardResolver((cls) => {
        const inst = instances.get(cls);
        if (!inst) throw new Error(`No instance for ${cls.name}`);
        return inst;
      });
    }

    it('should allow execution when guard returns true', async () => {
      withResolver();
      const handler = jest.fn().mockResolvedValue('ok');
      const guards: McpGuardMetadata[] = [{ guardClass: AllowGuard }];
      registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

      const result = await registry.executeToolRaw('tool', {});
      expect(result).toBe('ok');
      expect(handler).toHaveBeenCalled();
    });

    it('should reject execution when guard returns false', async () => {
      withResolver();
      const handler = jest.fn().mockResolvedValue('ok');
      const guards: McpGuardMetadata[] = [{ guardClass: DenyGuard }];
      registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

      await expect(registry.executeToolRaw('tool', {})).rejects.toThrow(/Access denied by DenyGuard/);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should reject on async guard returning false', async () => {
      withResolver();
      const handler = jest.fn().mockResolvedValue('ok');
      const guards: McpGuardMetadata[] = [{ guardClass: AsyncDenyGuard }];
      registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

      await expect(registry.executeToolRaw('tool', {})).rejects.toThrow(/Access denied/);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should run guards before validation (guard rejects invalid params without ZodError)', async () => {
      withResolver();
      const handler = jest.fn().mockResolvedValue('ok');
      const schema = z.object({ name: z.string() });
      const guards: McpGuardMetadata[] = [{ guardClass: DenyGuard }];
      registry.registerTool({ name: 'tool', description: 'd', schema }, handler, guards);

      // Pass params that would fail schema validation, but guard rejects first
      await expect(
        registry.executeToolRaw('tool', { name: 123 } as any),
      ).rejects.toThrow(/Access denied by DenyGuard/);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should run guards before interceptors', async () => {
      withResolver();
      const order: string[] = [];
      const handler = jest.fn().mockResolvedValue('ok');

      registry.registerInterceptor({
        async intercept(ctx, next) {
          order.push('interceptor');
          return next();
        },
      });
      const guards: McpGuardMetadata[] = [{ guardClass: DenyGuard }];
      registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

      await expect(registry.executeToolRaw('tool', {})).rejects.toThrow(/Access denied/);
      expect(order).toEqual([]);
    });

    it('should run multiple guards in order — first failure stops', async () => {
      withResolver();
      const handler = jest.fn().mockResolvedValue('ok');
      const guards: McpGuardMetadata[] = [
        { guardClass: AllowGuard },
        { guardClass: DenyGuard },
      ];
      registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

      await expect(registry.executeToolRaw('tool', {})).rejects.toThrow(/Access denied by DenyGuard/);
      expect(handler).not.toHaveBeenCalled();
    });

    it('should throw when guards are configured but no resolver is set', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      const guards: McpGuardMetadata[] = [{ guardClass: AllowGuard }];
      registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

      await expect(registry.executeToolRaw('tool', {})).rejects.toThrow(/no guard resolver/);
    });

    it('should pass config to the guard', async () => {
      withResolver();
      const handler = jest.fn().mockResolvedValue('ok');
      const guards: McpGuardMetadata[] = [
        { guardClass: McpScopeGuard, config: { scopes: ['write'] } },
      ];
      registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

      // With matching scopes — allowed
      await registry.executeToolRaw('tool', {}, MOCK_AUTH);
      expect(handler).toHaveBeenCalled();
    });

    describe('McpScopeGuard', () => {
      it('should allow when all required scopes are present', async () => {
        withResolver();
        const handler = jest.fn().mockResolvedValue('ok');
        const guards: McpGuardMetadata[] = [
          { guardClass: McpScopeGuard, config: { scopes: ['read', 'write'] } },
        ];
        registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

        await registry.executeToolRaw('tool', {}, MOCK_AUTH);
        expect(handler).toHaveBeenCalled();
      });

      it('should deny when a required scope is missing', async () => {
        withResolver();
        const handler = jest.fn().mockResolvedValue('ok');
        const guards: McpGuardMetadata[] = [
          { guardClass: McpScopeGuard, config: { scopes: ['admin'] } },
        ];
        registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

        await expect(
          registry.executeToolRaw('tool', {}, MOCK_AUTH),
        ).rejects.toThrow(/Access denied/);
      });

      it('should deny when no authInfo is provided', async () => {
        withResolver();
        const handler = jest.fn().mockResolvedValue('ok');
        const guards: McpGuardMetadata[] = [
          { guardClass: McpScopeGuard, config: { scopes: ['read'] } },
        ];
        registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

        await expect(
          registry.executeToolRaw('tool', {}),
        ).rejects.toThrow(/Access denied/);
      });

      it('should allow when no scopes are required', async () => {
        withResolver();
        const handler = jest.fn().mockResolvedValue('ok');
        const guards: McpGuardMetadata[] = [
          { guardClass: McpScopeGuard, config: { scopes: [] } },
        ];
        registry.registerTool({ name: 'tool', description: 'd' }, handler, guards);

        await registry.executeToolRaw('tool', {});
        expect(handler).toHaveBeenCalled();
      });
    });
  });

  describe('getToolJsonSchemas', () => {
    it('should return JSON schemas for all tools', () => {
      registry.registerTool({ name: 'tool', description: 'desc' }, jest.fn());

      const schemas = registry.getToolJsonSchemas();

      expect(schemas).toHaveLength(1);
      expect(schemas[0].name).toBe('tool');
      expect(schemas[0].description).toBe('desc');
      expect(schemas[0].jsonSchema).toHaveProperty('type', 'object');
    });
  });
});
