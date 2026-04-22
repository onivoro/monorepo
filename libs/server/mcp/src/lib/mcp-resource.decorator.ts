import { SetMetadata } from '@nestjs/common';
import { MCP_RESOURCE_METADATA } from './mcp-resource-metadata-token';
import type { McpResourceMetadata } from './mcp-resource-metadata';

export const McpResource = (metadata: McpResourceMetadata) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_RESOURCE_METADATA, metadata)(target, propertyKey, descriptor);
  };
};
