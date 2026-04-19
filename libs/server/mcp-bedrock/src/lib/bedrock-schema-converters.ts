import type { McpToolMetadata } from '@onivoro/server-mcp';
import { mcpSchemaToJsonSchema } from '@onivoro/server-mcp';

export function sanitizeToolNameForBedrock(name: string): string {
  return name.replace(/-/g, '_');
}

export function resolveBedrockName(metadata: McpToolMetadata): string {
  return metadata.aliases?.['bedrock'] ?? sanitizeToolNameForBedrock(metadata.name);
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
