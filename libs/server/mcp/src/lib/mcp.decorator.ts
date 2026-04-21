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

/**
 * Icon descriptor for MCP entities (spec 2025-11-25+).
 * Provides visual identity for tools, resources, and prompts in client UIs.
 */
export interface McpIcon {
  /** URL of the icon (HTTPS or data URI). */
  url: string;
  /** MIME type of the icon (e.g. 'image/svg+xml', 'image/png'). */
  mediaType?: string;
  /** Display size hint (e.g. '16x16', '32x32'). */
  size?: string;
}

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

/**
 * Annotations for MCP resources (spec 2025-11-25+).
 */
export interface McpResourceAnnotations {
  /** Who the resource content is intended for. */
  audience?: Array<'user' | 'assistant'>;
  /** Relative priority (0.0–1.0). Higher = more important. */
  priority?: number;
  /** ISO 8601 timestamp of the last modification. */
  lastModified?: string;
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
  /** Icons for client UI rendering (spec 2025-11-25+). */
  icons?: McpIcon[];
  /** Resource-level annotations (audience, priority, lastModified). */
  annotations?: McpResourceAnnotations;
  isTemplate?: boolean;
  /**
   * Callback to list all resources matching this template. Only used when isTemplate is true.
   * Must return `{ resources: [...] }` matching the MCP ListResourcesResult shape.
   */
  listCallback?: (...args: any[]) => any;
  /**
   * Autocompletion callbacks for URI template variables. Only used when isTemplate is true.
   * Each key is a variable name from the URI template; the callback returns possible completions.
   *
   * ```ts
   * completeCallbacks: {
   *   id: (value) => items.filter(i => i.startsWith(value)).map(i => i.id),
   * }
   * ```
   */
  completeCallbacks?: Record<string, (value: string, context?: { arguments?: Record<string, string> }) => string[] | Promise<string[]>>;
}

export interface McpPromptMetadata {
  name: string;
  /** Human-readable display name shown in MCP client UIs. */
  title?: string;
  description?: string;
  argsSchema?: Record<string, z.ZodTypeAny>;
  /** Icons for client UI rendering (spec 2025-11-25+). */
  icons?: McpIcon[];
  /**
   * Autocompletion callbacks for prompt arguments.
   * Each key is an argument name from argsSchema; the callback returns possible completions.
   *
   * ```ts
   * completeCallbacks: {
   *   language: (value) => ['typescript', 'python', 'rust'].filter(l => l.startsWith(value)),
   * }
   * ```
   */
  completeCallbacks?: Record<string, (value: string, context?: { arguments?: Record<string, string> }) => string[] | Promise<string[]>>;
}

export interface McpToolOptions {
  aliases?: Record<string, string>;
  annotations?: McpToolAnnotations;
  title?: string;
  outputSchema?: z.ZodObject<any>;
  /** Icons for client UI rendering (spec 2025-11-25+). */
  icons?: McpIcon[];
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
