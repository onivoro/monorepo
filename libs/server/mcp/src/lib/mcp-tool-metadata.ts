import { z } from 'zod';
import type { McpToolAnnotations } from './mcp-tool-annotations';
import type { McpIcon } from './mcp-icon';

export interface McpToolMetadata {
  name: string;
  description: string;
  /** Human-readable display name shown in MCP client UIs. */
  title?: string;
  schema?: z.ZodObject<any>;
  /** Output schema for structured output validation. When present, the SDK validates structuredContent against this schema. */
  outputSchema?: z.ZodObject<any>;
  aliases?: Record<string, string>;
  annotations?: McpToolAnnotations;
  /** Icons for client UI rendering (spec 2025-11-25+). */
  icons?: McpIcon[];
}
