import { z } from 'zod';
import type { McpToolAnnotations } from './mcp-tool-annotations';
import type { McpIcon } from './mcp-icon';

export interface McpToolOptions {
  aliases?: Record<string, string>;
  annotations?: McpToolAnnotations;
  title?: string;
  outputSchema?: z.ZodObject<any>;
  /** Icons for client UI rendering (spec 2025-11-25+). */
  icons?: McpIcon[];
}
