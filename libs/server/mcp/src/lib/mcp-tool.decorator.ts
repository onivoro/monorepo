import { SetMetadata } from '@nestjs/common';
import { z } from 'zod';
import { MCP_TOOL_METADATA } from './mcp-tool-metadata-token';
import type { McpToolMetadata } from './mcp-tool-metadata';
import type { McpToolOptions } from './mcp-tool-options';
import type { McpToolAnnotations } from './mcp-tool-annotations';

/**
 * Decorator for MCP tool methods.
 *
 * Accepts either positional `aliases`/`annotations` args (backward-compatible)
 * or a single options object as the 4th parameter:
 *
 * ```ts
 * @McpTool('name', 'desc', schema, { title: 'Display Name', aliases: { bedrock: 'name' }, annotations: { readOnlyHint: true } })
 * ```
 */
export const McpTool = (
  name: string,
  description: string,
  schema?: z.ZodObject<any>,
  aliasesOrOptions?: Record<string, string> | McpToolOptions,
  annotations?: McpToolAnnotations,
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    let metadata: McpToolMetadata;

    if (aliasesOrOptions && ('aliases' in aliasesOrOptions || 'annotations' in aliasesOrOptions || 'title' in aliasesOrOptions || 'outputSchema' in aliasesOrOptions || 'icons' in aliasesOrOptions)) {
      // Options object form
      const opts = aliasesOrOptions as McpToolOptions;
      metadata = { name, description, schema, ...opts };
    } else {
      // Positional form (backward-compatible)
      metadata = { name, description, schema, aliases: aliasesOrOptions as Record<string, string> | undefined, annotations };
    }

    SetMetadata(MCP_TOOL_METADATA, metadata)(target, propertyKey, descriptor);
  };
};
