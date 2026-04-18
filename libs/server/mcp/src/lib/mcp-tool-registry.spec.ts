import { McpToolRegistry } from './mcp-tool-registry';

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

    it('should populate Bedrock name map with auto-sanitized name', () => {
      registry.registerTool({ name: 'my-cool-tool', description: 'desc' }, jest.fn());
      expect(registry.resolveBedrockToolName('my_cool_tool')).toBe('my-cool-tool');
    });

    it('should populate Bedrock name map with explicit alias', () => {
      registry.registerTool(
        { name: 'my-tool', description: 'desc', aliases: { bedrock: 'custom_name' } },
        jest.fn(),
      );
      expect(registry.resolveBedrockToolName('custom_name')).toBe('my-tool');
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

  describe('executeTool', () => {
    it('should call the raw handler and return its result', async () => {
      const handler = jest.fn().mockResolvedValue({ data: 'hello' });
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeTool('tool', { input: 'x' });

      expect(handler).toHaveBeenCalledWith({ input: 'x' });
      expect(result).toEqual({ data: 'hello' });
    });

    it('should throw for unknown tool', async () => {
      await expect(registry.executeTool('nope', {})).rejects.toThrow(/not registered/);
    });
  });

  describe('executeToolMcp', () => {
    it('should pass through results with content', async () => {
      const handler = jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'hello' }],
      });
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolMcp('tool', {});
      expect(result).toEqual({ content: [{ type: 'text', text: 'hello' }] });
    });

    it('should wrap string results', async () => {
      const handler = jest.fn().mockResolvedValue('plain text');
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolMcp('tool', {});
      expect(result).toEqual({ content: [{ type: 'text', text: 'plain text' }] });
    });

    it('should stringify object results', async () => {
      const handler = jest.fn().mockResolvedValue({ key: 'value' });
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolMcp('tool', {});
      expect(result.content[0].text).toContain('"key": "value"');
    });

    it('should catch errors and return error content', async () => {
      const handler = jest.fn().mockRejectedValue(new Error('boom'));
      registry.registerTool({ name: 'tool', description: 'd' }, handler);

      const result = await registry.executeToolMcp('tool', {});
      expect(result.content[0].text).toContain('Error executing tool');
      expect(result.content[0].text).toContain('boom');
    });
  });

  describe('executeToolBedrock', () => {
    it('should resolve Bedrock name and return stringified result', async () => {
      const handler = jest.fn().mockResolvedValue({ enhanced: true });
      registry.registerTool({ name: 'my-tool', description: 'd' }, handler);

      const result = await registry.executeToolBedrock('my_tool', { x: 1 });
      expect(handler).toHaveBeenCalledWith({ x: 1 });
      expect(result).toBe('{"enhanced":true}');
    });

    it('should return strings as-is', async () => {
      const handler = jest.fn().mockResolvedValue('raw text');
      registry.registerTool({ name: 'my-tool', description: 'd' }, handler);

      const result = await registry.executeToolBedrock('my_tool', {});
      expect(result).toBe('raw text');
    });

    it('should use explicit alias for resolution', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool(
        { name: 'tool-x', description: 'd', aliases: { bedrock: 'toolX' } },
        handler,
      );

      const result = await registry.executeToolBedrock('toolX', {});
      expect(result).toBe('ok');
    });

    it('should throw for unknown Bedrock name', async () => {
      await expect(registry.executeToolBedrock('unknown', {})).rejects.toThrow(
        /No MCP tool found/,
      );
    });
  });

  describe('toBedrockTools', () => {
    it('should convert all tools to Bedrock format', () => {
      registry.registerTool({ name: 'tool-a', description: 'Desc A' }, jest.fn());
      registry.registerTool({ name: 'tool-b', description: 'Desc B' }, jest.fn());

      const bedrock = registry.toBedrockTools();

      expect(bedrock).toHaveLength(2);
      expect(bedrock[0].toolSpec.name).toBe('tool_a');
      expect(bedrock[0].toolSpec.description).toBe('Desc A');
      expect(bedrock[1].toolSpec.name).toBe('tool_b');
    });

    it('should use explicit Bedrock alias', () => {
      registry.registerTool(
        { name: 'my-tool', description: 'd', aliases: { bedrock: 'custom_name' } },
        jest.fn(),
      );

      const bedrock = registry.toBedrockTools();
      expect(bedrock[0].toolSpec.name).toBe('custom_name');
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
