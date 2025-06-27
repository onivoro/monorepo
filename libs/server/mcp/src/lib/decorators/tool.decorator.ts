import { SetMetadata } from '@nestjs/common';
import { z } from 'zod';

export interface ToolMetadata {
  name: string;
  description: string;
  schema?: Record<string, z.ZodTypeAny>;
}

export const MCP_TOOL_METADATA = 'mcp:tool';

/**
 * Decorator to mark a method as an MCP tool
 * 
 * @param name - Tool name for MCP
 * @param description - Tool description
 * @param schema - Zod schema for parameters (optional)
 */
export const Tool = (
  name: string, 
  description: string, 
  schema?: Record<string, z.ZodTypeAny>
) => {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    SetMetadata(MCP_TOOL_METADATA, { name, description, schema })(target, propertyKey, descriptor);
  };
};

/**
 * Decorator for tool parameters (for better type safety and documentation)
 */
export const ToolParam = (name: string, options?: { optional?: boolean; description?: string }) => {
  return (target: any, propertyKey: string, parameterIndex: number) => {
    const existingParams = Reflect.getMetadata('mcp:params', target, propertyKey) || [];
    existingParams[parameterIndex] = { name, ...options };
    Reflect.defineMetadata('mcp:params', existingParams, target, propertyKey);
  };
};