import { z } from 'zod';
import type { McpToolMetadata } from './mcp.decorator';

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

export function sanitizeToolNameForBedrock(name: string): string {
  return name.replace(/-/g, '_');
}

export function resolveBedrockName(metadata: McpToolMetadata): string {
  return metadata.aliases?.bedrock ?? sanitizeToolNameForBedrock(metadata.name);
}

export interface BedrockToolDefinition {
  toolSpec: {
    name: string;
    description: string;
    inputSchema: { json: Record<string, unknown> };
  };
}

export function toBedrockToolDefinition(
  metadata: McpToolMetadata,
): BedrockToolDefinition {
  return {
    toolSpec: {
      name: resolveBedrockName(metadata),
      description: metadata.description,
      inputSchema: { json: mcpSchemaToJsonSchema(metadata.schema) },
    },
  };
}
