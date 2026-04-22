import { SetMetadata } from '@nestjs/common';
import { MCP_TOOL_METADATA } from './mcp-tool-metadata-token';
import type { McpToolMetadata } from './mcp-tool-metadata';

/**
 * Decorator for MCP tool methods.
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
 */
export const McpTool = (metadata: McpToolMetadata) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_TOOL_METADATA, metadata)(target, propertyKey, descriptor);
  };
};
