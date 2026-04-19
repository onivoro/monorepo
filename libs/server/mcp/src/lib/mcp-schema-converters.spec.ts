import { z } from 'zod';
import { mcpSchemaToJsonSchema } from './mcp-schema-converters';

describe('mcp-schema-converters', () => {
  describe('mcpSchemaToJsonSchema', () => {
    it('should return empty object schema when no schema provided', () => {
      const result = mcpSchemaToJsonSchema(undefined);
      expect(result).toEqual({ type: 'object', properties: {} });
    });

    it('should convert zod schema to JSON Schema', () => {
      const schema = z.object({
        text: z.string().describe('Input text'),
        count: z.number().optional().describe('Count'),
      });

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
      const schema = z.object({ text: z.string() });
      const result = mcpSchemaToJsonSchema(schema);
      expect(result).not.toHaveProperty('$schema');
    });
  });
});
