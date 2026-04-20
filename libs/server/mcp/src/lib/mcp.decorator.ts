import { SetMetadata } from '@nestjs/common';
import { z } from 'zod';
import {
  MCP_TOOL_METADATA,
  MCP_RESOURCE_METADATA,
  MCP_PROMPT_METADATA,
} from './mcp.constants';

/**
 * Behavioral hints for MCP clients (spec 2025-03-26+).
 * All fields are optional and advisory — clients MAY use them
 * for UX decisions (e.g. skipping confirmation for read-only tools).
 */
export interface McpToolAnnotations {
  /** Tool does not modify its environment. */
  readOnlyHint?: boolean;
  /** Tool may perform destructive updates (delete, overwrite). */
  destructiveHint?: boolean;
  /** Repeated calls with the same args have no additional effect. */
  idempotentHint?: boolean;
  /** Tool may interact with external entities (network, third-party APIs). */
  openWorldHint?: boolean;
}

export interface McpToolMetadata {
  name: string;
  description: string;
  /** Human-readable display name shown in MCP client UIs. */
  title?: string;
  schema?: z.ZodObject<any>;
  aliases?: Record<string, string>;
  annotations?: McpToolAnnotations;
}

export interface McpResourceMetadata {
  name: string;
  uri: string;
  /** Human-readable display name shown in MCP client UIs. */
  title?: string;
  description?: string;
  mimeType?: string;
  /** Size in bytes, helps clients decide whether to fetch large resources. */
  size?: number;
  isTemplate?: boolean;
  /**
   * Callback to list all resources matching this template. Only used when isTemplate is true.
   * Must return `{ resources: [...] }` matching the MCP ListResourcesResult shape.
   */
  listCallback?: (...args: any[]) => any;
}

export interface McpPromptMetadata {
  name: string;
  /** Human-readable display name shown in MCP client UIs. */
  title?: string;
  description?: string;
  argsSchema?: Record<string, z.ZodTypeAny>;
}

export interface McpToolOptions {
  aliases?: Record<string, string>;
  annotations?: McpToolAnnotations;
  title?: string;
}

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

    if (aliasesOrOptions && ('aliases' in aliasesOrOptions || 'annotations' in aliasesOrOptions || 'title' in aliasesOrOptions)) {
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

export const McpResource = (metadata: McpResourceMetadata) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_RESOURCE_METADATA, metadata)(target, propertyKey, descriptor);
  };
};

export const McpPrompt = (metadata: McpPromptMetadata) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_PROMPT_METADATA, metadata)(target, propertyKey, descriptor);
  };
};
