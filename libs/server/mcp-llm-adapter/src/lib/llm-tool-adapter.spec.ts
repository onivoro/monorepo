import { McpToolRegistry } from '@onivoro/server-mcp';
import { LlmToolAdapter } from './llm-tool-adapter';
import { LlmAdapterConfig } from './llm-adapter.config';

interface SimpleToolDef {
  name: string;
  description: string;
  schema: Record<string, unknown>;
}

const SIMPLE_CONFIG: LlmAdapterConfig<SimpleToolDef> = {
  aliasKey: 'test',
  formatTool: (name, description, jsonSchema) => ({
    name,
    description,
    schema: jsonSchema,
  }),
};

const SANITIZING_CONFIG: LlmAdapterConfig<SimpleToolDef> = {
  aliasKey: 'test',
  sanitizeName: (name) => name.replace(/-/g, '_'),
  formatTool: (name, description, jsonSchema) => ({
    name,
    description,
    schema: jsonSchema,
  }),
};

describe('LlmToolAdapter', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    registry = new McpToolRegistry();
  });

  describe('resolveProviderToolName', () => {
    it('should resolve name using pass-through when no sanitizer', () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      registry.registerTool({ name: 'my-tool', description: 'desc' }, jest.fn());
      expect(adapter.resolveProviderToolName('my-tool')).toBe('my-tool');
    });

    it('should resolve sanitized name to MCP name', () => {
      const adapter = new LlmToolAdapter(registry, SANITIZING_CONFIG);
      registry.registerTool({ name: 'my-cool-tool', description: 'desc' }, jest.fn());
      expect(adapter.resolveProviderToolName('my_cool_tool')).toBe('my-cool-tool');
    });

    it('should resolve explicit alias to MCP name', () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      registry.registerTool(
        { name: 'my-tool', description: 'desc', aliases: { test: 'custom_name' } },
        jest.fn(),
      );
      expect(adapter.resolveProviderToolName('custom_name')).toBe('my-tool');
    });

    it('should return undefined for unknown name', () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      expect(adapter.resolveProviderToolName('unknown')).toBeUndefined();
    });
  });

  describe('toProviderTools', () => {
    it('should convert all tools to provider format', () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      registry.registerTool({ name: 'tool-a', description: 'Desc A' }, jest.fn());
      registry.registerTool({ name: 'tool-b', description: 'Desc B' }, jest.fn());

      const tools = adapter.toProviderTools();

      expect(tools).toHaveLength(2);
      expect(tools[0].name).toBe('tool-a');
      expect(tools[0].description).toBe('Desc A');
      expect(tools[1].name).toBe('tool-b');
    });

    it('should apply name sanitization', () => {
      const adapter = new LlmToolAdapter(registry, SANITIZING_CONFIG);
      registry.registerTool({ name: 'my-tool', description: 'desc' }, jest.fn());

      const tools = adapter.toProviderTools();
      expect(tools[0].name).toBe('my_tool');
    });

    it('should use explicit alias over sanitization', () => {
      const adapter = new LlmToolAdapter(registry, SANITIZING_CONFIG);
      registry.registerTool(
        { name: 'my-tool', description: 'desc', aliases: { test: 'custom' } },
        jest.fn(),
      );

      const tools = adapter.toProviderTools();
      expect(tools[0].name).toBe('custom');
    });
  });

  describe('executeToolForProvider', () => {
    it('should resolve provider name and return stringified result', async () => {
      const adapter = new LlmToolAdapter(registry, SANITIZING_CONFIG);
      const handler = jest.fn().mockResolvedValue({ enhanced: true });
      registry.registerTool({ name: 'my-tool', description: 'd' }, handler);

      const result = await adapter.executeToolForProvider('my_tool', { x: 1 });
      expect(handler).toHaveBeenCalledWith(
        { x: 1 },
        expect.objectContaining({ toolName: 'my-tool', params: { x: 1 } }),
      );
      expect(result).toBe('{"enhanced":true}');
    });

    it('should return strings as-is', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      const handler = jest.fn().mockResolvedValue('raw text');
      registry.registerTool({ name: 'my-tool', description: 'd' }, handler);

      const result = await adapter.executeToolForProvider('my-tool', {});
      expect(result).toBe('raw text');
    });

    it('should use explicit alias for resolution', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool(
        { name: 'tool-x', description: 'd', aliases: { test: 'toolX' } },
        handler,
      );

      const result = await adapter.executeToolForProvider('toolX', {});
      expect(result).toBe('ok');
    });

    it('should throw for unknown provider name', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      await expect(
        adapter.executeToolForProvider('unknown', {}),
      ).rejects.toThrow(/No MCP tool found/);
    });
  });

  describe('executeToolsForProvider', () => {
    it('should execute multiple tools in parallel and return results', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      registry.registerTool({ name: 'tool-a', description: 'd' }, jest.fn().mockResolvedValue({ a: 1 }));
      registry.registerTool({ name: 'tool-b', description: 'd' }, jest.fn().mockResolvedValue('text'));

      const results = await adapter.executeToolsForProvider([
        { providerName: 'tool-a', params: { x: 1 }, id: 'call-1' },
        { providerName: 'tool-b', params: {}, id: 'call-2' },
      ]);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ providerName: 'tool-a', id: 'call-1', result: '{"a":1}', success: true });
      expect(results[1]).toEqual({ providerName: 'tool-b', id: 'call-2', result: 'text', success: true });
    });

    it('should handle partial failures independently', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      registry.registerTool({ name: 'ok-tool', description: 'd' }, jest.fn().mockResolvedValue('ok'));
      registry.registerTool({ name: 'bad-tool', description: 'd' }, jest.fn().mockRejectedValue(new Error('boom')));

      const results = await adapter.executeToolsForProvider([
        { providerName: 'ok-tool', params: {} },
        { providerName: 'bad-tool', params: {} },
      ]);

      expect(results[0].success).toBe(true);
      expect(results[0].result).toBe('ok');
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('boom');
    });

    it('should report unknown provider names as errors without blocking siblings', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      registry.registerTool({ name: 'real-tool', description: 'd' }, jest.fn().mockResolvedValue('done'));

      const results = await adapter.executeToolsForProvider([
        { providerName: 'real-tool', params: {}, id: 'a' },
        { providerName: 'ghost-tool', params: {}, id: 'b' },
      ]);

      expect(results[0]).toEqual({ providerName: 'real-tool', id: 'a', result: 'done', success: true });
      expect(results[1].success).toBe(false);
      expect(results[1].error).toContain('No MCP tool found');
      expect(results[1].id).toBe('b');
    });

    it('should return empty array for empty input', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      const results = await adapter.executeToolsForProvider([]);
      expect(results).toEqual([]);
    });

    it('should pass through id from input to output', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      registry.registerTool({ name: 'tool', description: 'd' }, jest.fn().mockResolvedValue('r'));

      const results = await adapter.executeToolsForProvider([
        { providerName: 'tool', params: {}, id: 'openai-call-xyz' },
        { providerName: 'tool', params: {} },
      ]);

      expect(results[0].id).toBe('openai-call-xyz');
      expect(results[1].id).toBeUndefined();
    });

    it('should forward authInfo to all tool executions', async () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const authInfo = { token: 'tok', clientId: 'c1', scopes: ['read'] };
      await adapter.executeToolsForProvider(
        [{ providerName: 'tool', params: { x: 1 } }],
        authInfo,
      );

      expect(handler).toHaveBeenCalledWith(
        { x: 1 },
        expect.objectContaining({ authInfo }),
      );
    });
  });

  describe('name map caching', () => {
    it('should invalidate cache when a new tool is registered', () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      adapter.onModuleInit();

      registry.registerTool({ name: 'tool-a', description: 'd' }, jest.fn());
      expect(adapter.resolveProviderToolName('tool-a')).toBe('tool-a');

      registry.registerTool({ name: 'tool-b', description: 'd' }, jest.fn());
      expect(adapter.resolveProviderToolName('tool-b')).toBe('tool-b');
    });

    it('should reuse cached map on repeated calls without changes', () => {
      const adapter = new LlmToolAdapter(registry, SIMPLE_CONFIG);
      adapter.onModuleInit();

      registry.registerTool({ name: 'tool-a', description: 'd' }, jest.fn());

      const result1 = adapter.resolveProviderToolName('tool-a');
      const result2 = adapter.resolveProviderToolName('tool-a');
      expect(result1).toBe('tool-a');
      expect(result2).toBe('tool-a');
    });
  });
});
