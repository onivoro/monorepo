import { z } from 'zod';

export function mcpSchemaToJsonSchema(
  schema: z.ZodObject<any> | undefined,
): Record<string, unknown> {
  if (!schema) {
    return { type: 'object', properties: {} };
  }
  const result = z.toJSONSchema(schema);
  const { $schema, ...rest } = result as Record<string, unknown>;
  return rest;
}
