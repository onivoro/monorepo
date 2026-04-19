import { SetMetadata } from '@nestjs/common';
import { z } from 'zod';
import {
  MCP_TOOL_METADATA,
  MCP_RESOURCE_METADATA,
  MCP_PROMPT_METADATA,
} from './mcp.constants';

export interface McpToolMetadata {
  name: string;
  description: string;
  schema?: z.ZodObject<any>;
  aliases?: Record<string, string>;
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
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_TOOL_METADATA, { name, description, schema, aliases } as McpToolMetadata)(
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
