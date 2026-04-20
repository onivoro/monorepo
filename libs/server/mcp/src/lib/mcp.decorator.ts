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
  schema?: z.ZodObject<any>;
  aliases?: Record<string, string>;
  annotations?: McpToolAnnotations;
}

export interface McpResourceMetadata {
  name: string;
  uri: string;
  description?: string;
  mimeType?: string;
  isTemplate?: boolean;
}

export interface McpPromptMetadata {
  name: string;
  description?: string;
  argsSchema?: Record<string, z.ZodTypeAny>;
}

export const McpTool = (
  name: string,
  description: string,
  schema?: z.ZodObject<any>,
  aliases?: Record<string, string>,
  annotations?: McpToolAnnotations,
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_TOOL_METADATA, { name, description, schema, aliases, annotations } as McpToolMetadata)(
      target,
      propertyKey,
      descriptor,
    );
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
