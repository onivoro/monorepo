import { z } from 'zod';
import {
  mcpSchemaToJsonSchema,
  sanitizeToolNameForBedrock,
  resolveBedrockName,
  toBedrockToolDefinition,
} from './mcp-schema-converters';

describe('mcp-schema-converters', () => {
  describe('mcpSchemaToJsonSchema', () => {
    it('should return empty object schema when no schema provided', () => {
      const result = mcpSchemaToJsonSchema(undefined);
      expect(result).toEqual({ type: 'object', properties: {} });
    });

    it('should convert zod schema to JSON Schema', () => {
      const schema = {
        text: z.string().describe('Input text'),
        count: z.number().optional().describe('Count'),
      };

      const result = mcpSchemaToJsonSchema(schema);

      expect(result).toHaveProperty('type', 'object');
      expect(result).toHaveProperty('properties');
      const props = result['properties'] as Record<string, any>;
      expect(props['text']).toHaveProperty('type', 'string');
      expect(props['text']).toHaveProperty('description', 'Input text');
      expect(props['count']).toHaveProperty('type', 'number');
      expect(result['required']).toContain('text');
    });

    it('should strip $schema from output', () => {
      const schema = { text: z.string() };
      const result = mcpSchemaToJsonSchema(schema);
      expect(result).not.toHaveProperty('$schema');
    });
  });

  describe('sanitizeToolNameForBedrock', () => {
    it('should replace hyphens with underscores', () => {
      expect(sanitizeToolNameForBedrock('insert-emojis')).toBe('insert_emojis');
    });

    it('should leave underscores unchanged', () => {
      expect(sanitizeToolNameForBedrock('my_tool')).toBe('my_tool');
    });

    it('should handle names without hyphens', () => {
      expect(sanitizeToolNameForBedrock('simple')).toBe('simple');
    });

    it('should handle multiple hyphens', () => {
      expect(sanitizeToolNameForBedrock('a-b-c-d')).toBe('a_b_c_d');
    });
  });

  describe('resolveBedrockName', () => {
    it('should use explicit alias when provided', () => {
      const name = resolveBedrockName({
        name: 'my-tool',
        description: 'desc',
        aliases: { bedrock: 'custom_name' },
      });
      expect(name).toBe('custom_name');
    });

    it('should fall back to auto-sanitization when no alias', () => {
      const name = resolveBedrockName({
        name: 'my-tool',
        description: 'desc',
      });
      expect(name).toBe('my_tool');
    });

    it('should fall back when aliases exists but no bedrock alias', () => {
      const name = resolveBedrockName({
        name: 'my-tool',
        description: 'desc',
        aliases: { openai: 'something' },
      });
      expect(name).toBe('my_tool');
    });
  });

  describe('toBedrockToolDefinition', () => {
    it('should produce correct Bedrock format', () => {
      const result = toBedrockToolDefinition({
        name: 'insert-emojis',
        description: 'Insert emojis into text',
        schema: {
          text: z.string().describe('The text'),
          intensity: z.enum(['subtle', 'moderate', 'heavy']).optional(),
        },
      });

      expect(result.toolSpec.name).toBe('insert_emojis');
      expect(result.toolSpec.description).toBe('Insert emojis into text');
      const json = result.toolSpec.inputSchema.json;
      expect(json).toHaveProperty('type', 'object');
      expect(json).toHaveProperty('properties');
      const props = json['properties'] as Record<string, any>;
      expect(props['text']).toHaveProperty('type', 'string');
      expect(props['text']).toHaveProperty('description', 'The text');
    });

    it('should handle tool with no schema', () => {
      const result = toBedrockToolDefinition({
        name: 'simple-tool',
        description: 'No params',
      });

      expect(result.toolSpec.inputSchema.json).toEqual({
        type: 'object',
        properties: {},
      });
    });

    it('should use explicit Bedrock alias', () => {
      const result = toBedrockToolDefinition({
        name: 'my-tool',
        description: 'desc',
        aliases: { bedrock: 'myTool' },
      });

      expect(result.toolSpec.name).toBe('myTool');
    });
  });
});
