import { SetMetadata } from '@nestjs/common';
import { MCP_PROMPT_METADATA } from './mcp-prompt-metadata-token';
import type { McpPromptMetadata } from './mcp-prompt-metadata';

export const McpPrompt = (metadata: McpPromptMetadata) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_PROMPT_METADATA, metadata)(target, propertyKey, descriptor);
  };
};
