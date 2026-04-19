import { McpToolRegistry } from '@onivoro/server-mcp';
import { BedrockToolAdapter } from './bedrock-tool-adapter';

describe('BedrockToolAdapter', () => {
  let registry: McpToolRegistry;
  let adapter: BedrockToolAdapter;

  beforeEach(() => {
    registry = new McpToolRegistry();
    adapter = new BedrockToolAdapter(registry);
  });

  describe('resolveBedrockToolName', () => {
    it('should resolve auto-sanitized Bedrock name to MCP name', () => {
      registry.registerTool({ name: 'my-cool-tool', description: 'desc' }, jest.fn());
      expect(adapter.resolveBedrockToolName('my_cool_tool')).toBe('my-cool-tool');
    });

    it('should resolve explicit Bedrock alias to MCP name', () => {
      registry.registerTool(
        { name: 'my-tool', description: 'desc', aliases: { bedrock: 'custom_name' } },
        jest.fn(),
      );
      expect(adapter.resolveBedrockToolName('custom_name')).toBe('my-tool');
    });

    it('should return undefined for unknown Bedrock name', () => {
      expect(adapter.resolveBedrockToolName('unknown')).toBeUndefined();
    });
  });

  describe('executeToolBedrock', () => {
    it('should resolve Bedrock name and return stringified result', async () => {
      const handler = jest.fn().mockResolvedValue({ enhanced: true });
      registry.registerTool({ name: 'my-tool', description: 'd' }, handler);

      const result = await adapter.executeToolBedrock('my_tool', { x: 1 });
      expect(handler).toHaveBeenCalledWith({ x: 1 });
      expect(result).toBe('{"enhanced":true}');
    });

    it('should return strings as-is', async () => {
      const handler = jest.fn().mockResolvedValue('raw text');
      registry.registerTool({ name: 'my-tool', description: 'd' }, handler);

      const result = await adapter.executeToolBedrock('my_tool', {});
      expect(result).toBe('raw text');
    });

    it('should use explicit alias for resolution', async () => {
      const handler = jest.fn().mockResolvedValue('ok');
      registry.registerTool(
        { name: 'tool-x', description: 'd', aliases: { bedrock: 'toolX' } },
        handler,
      );

      const result = await adapter.executeToolBedrock('toolX', {});
      expect(result).toBe('ok');
    });

    it('should throw for unknown Bedrock name', async () => {
      await expect(adapter.executeToolBedrock('unknown', {})).rejects.toThrow(
        /No MCP tool found/,
      );
    });
  });

  describe('toBedrockTools', () => {
    it('should convert all tools to Bedrock format', () => {
      registry.registerTool({ name: 'tool-a', description: 'Desc A' }, jest.fn());
      registry.registerTool({ name: 'tool-b', description: 'Desc B' }, jest.fn());

      const bedrock = adapter.toBedrockTools();

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

      const bedrock = adapter.toBedrockTools();
      expect(bedrock[0].toolSpec.name).toBe('custom_name');
    });
  });
});
