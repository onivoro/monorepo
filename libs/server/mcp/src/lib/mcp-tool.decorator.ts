import { SetMetadata } from '@nestjs/common';
import { MCP_TOOL_METADATA } from './mcp-tool-metadata-token';
import type { McpToolMetadata } from './mcp-tool-metadata';

/**
 * Decorator for MCP tool methods.
 *
 * Preferred form — single metadata object (consistent with @McpResource and @McpPrompt):
 *
 * ```ts
 * @McpTool({
 *   name: 'insert-emojis',
 *   description: 'Insert emojis into text',
 *   schema: insertEmojisSchema,
 *   aliases: { bedrock: 'insertEmojis' },
 *   annotations: { readOnlyHint: true },
 * })
 * ```
 *
 * @deprecated Positional form — supported for backward compatibility:
 * ```ts
 * @McpTool('name', 'desc', schema)
 * ```
 */
export function McpTool(metadata: McpToolMetadata): MethodDecorator;
/** @deprecated Use the object form: `@McpTool({ name, description, schema?, ... })` */
export function McpTool(
  name: string,
  description: string,
  schema?: McpToolMetadata['schema'],
  aliases?: Record<string, string>,
  annotations?: McpToolMetadata['annotations'],
): MethodDecorator;
export function McpTool(
  nameOrMetadata: string | McpToolMetadata,
  description?: string,
  schema?: McpToolMetadata['schema'],
  aliases?: Record<string, string>,
  annotations?: McpToolMetadata['annotations'],
): MethodDecorator {
  return (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const metadata: McpToolMetadata =
      typeof nameOrMetadata === 'object'
        ? nameOrMetadata
        : { name: nameOrMetadata, description: description!, schema, aliases, annotations };

    SetMetadata(MCP_TOOL_METADATA, metadata)(target, propertyKey as string, descriptor);
  };
}
