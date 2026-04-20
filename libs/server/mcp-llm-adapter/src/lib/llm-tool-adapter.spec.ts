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
});
