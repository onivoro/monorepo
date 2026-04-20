import { Injectable, Logger } from '@nestjs/common';
import type { McpToolMetadata, McpResourceMetadata, McpPromptMetadata } from './mcp.decorator';
import { mcpSchemaToJsonSchema } from './mcp-schema-converters';

/**
 * Authentication/authorization info from the MCP transport layer.
 * Compatible with the MCP SDK's AuthInfo but defined independently
 * so the core registry has no SDK dependency.
 */
export interface McpAuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  extra?: Record<string, unknown>;
}

/**
 * Context passed to tool handlers and hooks during execution.
 */
export interface McpToolContext {
  toolName: string;
  params: Record<string, unknown>;
  metadata: McpToolMetadata;
  authInfo?: McpAuthInfo;
}

/**
 * Hook interface for cross-cutting concerns around tool execution.
 * Implement as an injectable NestJS service and register via the module config
 * or directly on the registry.
 */
export interface McpToolHook {
  beforeToolCall?(context: McpToolContext): Promise<void> | void;
  afterToolCall?(context: McpToolContext, result: unknown): Promise<void> | void;
}

/**
 * Guard interface for per-tool authorization.
 * Implement as an injectable NestJS service and reference via @McpGuard().
 */
export interface McpCanActivate {
  canActivate(
    context: McpToolContext,
    config?: Record<string, unknown>,
  ): boolean | Promise<boolean>;
}

/**
 * Metadata attached by the @McpGuard decorator.
 */
export interface McpGuardMetadata {
  guardClass: new (...args: any[]) => McpCanActivate;
  config?: Record<string, unknown>;
}

interface ToolEntry {
  metadata: McpToolMetadata;
  handler: (params: any, context?: McpToolContext) => Promise<any>;
  guards?: McpGuardMetadata[];
}

interface ResourceEntry {
  metadata: McpResourceMetadata;
  handler: (...args: any[]) => Promise<any>;
}

interface PromptEntry {
  metadata: McpPromptMetadata;
  handler: (...args: any[]) => Promise<any>;
}

export interface McpTextContent {
  type: 'text';
  text: string;
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}

export interface McpImageContent {
  type: 'image';
  data: string;
  mimeType: string;
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}

export interface McpAudioContent {
  type: 'audio';
  data: string;
  mimeType: string;
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}

export interface McpEmbeddedResource {
  type: 'resource';
  resource: { uri: string; text?: string; blob?: string; mimeType?: string };
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}

export interface McpResourceLink {
  type: 'resource_link';
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
  annotations?: { audience?: Array<'user' | 'assistant'>; priority?: number };
}

export type McpContentBlock =
  | McpTextContent
  | McpImageContent
  | McpAudioContent
  | McpEmbeddedResource
  | McpResourceLink;

export interface McpToolResult {
  content: McpContentBlock[];
}

@Injectable()
export class McpToolRegistry {
  private readonly logger = new Logger(McpToolRegistry.name);

  private readonly tools = new Map<string, ToolEntry>();
  private readonly resources = new Map<string, ResourceEntry>();
  private readonly prompts = new Map<string, PromptEntry>();
  private readonly hooks: McpToolHook[] = [];
  private guardResolver?: (guardClass: new (...args: any[]) => McpCanActivate) => McpCanActivate;

  // -- Registration --

  registerHook(hook: McpToolHook): void {
    this.hooks.push(hook);
  }

  setGuardResolver(
    resolver: (guardClass: new (...args: any[]) => McpCanActivate) => McpCanActivate,
  ): void {
    this.guardResolver = resolver;
  }

  registerTool(
    metadata: McpToolMetadata,
    handler: (params: any) => Promise<any>,
    guards?: McpGuardMetadata[],
  ): void {
    if (this.tools.has(metadata.name)) {
      throw new Error(
        `MCP tool "${metadata.name}" is already registered. Tool names must be unique across all providers.`,
      );
    }
    this.tools.set(metadata.name, { metadata, handler, guards });

    this.logger.log(`Tool registered: ${metadata.name}`);
  }

  registerResource(
    metadata: McpResourceMetadata,
    handler: (...args: any[]) => Promise<any>,
  ): void {
    if (this.resources.has(metadata.name)) {
      throw new Error(
        `MCP resource "${metadata.name}" is already registered. Resource names must be unique across all providers.`,
      );
    }
    this.resources.set(metadata.name, { metadata, handler });
    this.logger.log(`Resource registered: ${metadata.name}`);
  }

  registerPrompt(
    metadata: McpPromptMetadata,
    handler: (...args: any[]) => Promise<any>,
  ): void {
    if (this.prompts.has(metadata.name)) {
      throw new Error(
        `MCP prompt "${metadata.name}" is already registered. Prompt names must be unique across all providers.`,
      );
    }
    this.prompts.set(metadata.name, { metadata, handler });
    this.logger.log(`Prompt registered: ${metadata.name}`);
  }

  // -- Introspection --

  getTools(): ReadonlyArray<ToolEntry> {
    return Array.from(this.tools.values());
  }

  getResources(): ReadonlyArray<ResourceEntry> {
    return Array.from(this.resources.values());
  }

  getPrompts(): ReadonlyArray<PromptEntry> {
    return Array.from(this.prompts.values());
  }

  getTool(name: string): ToolEntry | undefined {
    return this.tools.get(name);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  // -- Execution --

  /**
   * Execution pipeline (modeled after NestJS HTTP lifecycle):
   *
   *   Guards → Pipes (schema.parse) → beforeToolCall hooks → Handler → afterToolCall hooks
   *
   * Errors at any stage propagate normally. executeToolWrapped catches them
   * and returns error content (analogous to exception filters).
   */
  async executeToolRaw(
    name: string,
    params: Record<string, unknown>,
    authInfo?: McpAuthInfo,
  ): Promise<unknown> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`MCP tool "${name}" is not registered.`);
    }

    // -- Guards (authorization) --
    // Run first with raw params. Guards check auth, not input shape.
    const guardContext: McpToolContext = {
      toolName: name,
      params,
      metadata: entry.metadata,
      authInfo,
    };

    if (entry.guards?.length) {
      if (!this.guardResolver) {
        throw new Error(
          `Tool "${name}" has guards configured but no guard resolver is set. ` +
          'Ensure the module supports guard resolution.',
        );
      }
      for (const { guardClass, config } of entry.guards) {
        const guard = this.guardResolver(guardClass);
        const allowed = await guard.canActivate(guardContext, config);
        if (!allowed) {
          throw new Error(
            `Access denied by ${guardClass.name} for tool "${name}".`,
          );
        }
      }
    }

    // -- Pipes (validation/transformation) --
    const validatedParams = entry.metadata.schema
      ? entry.metadata.schema.parse(params)
      : params;

    const context: McpToolContext = {
      toolName: name,
      params: validatedParams,
      metadata: entry.metadata,
      authInfo,
    };

    // -- Hooks (before) --
    for (const hook of this.hooks) {
      if (hook.beforeToolCall) await hook.beforeToolCall(context);
    }

    // -- Handler --
    const result = await entry.handler(validatedParams, context);

    // -- Hooks (after) --
    for (const hook of this.hooks) {
      if (hook.afterToolCall) await hook.afterToolCall(context, result);
    }

    return result;
  }

  async executeToolWrapped(
    name: string,
    params: Record<string, unknown>,
    authInfo?: McpAuthInfo,
  ): Promise<McpToolResult> {
    try {
      const result = await this.executeToolRaw(name, params, authInfo);

      if (
        result &&
        typeof result === 'object' &&
        (result as any).content
      ) {
        return result as McpToolResult;
      }

      return {
        content: [
          {
            type: 'text',
            text:
              typeof result === 'string'
                ? result
                : JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (error) {
      this.logger.error(`Error executing tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  }

  // -- Schema Conversion --

  getToolJsonSchemas(): Array<{
    name: string;
    description: string;
    jsonSchema: Record<string, unknown>;
  }> {
    return this.getTools().map((entry) => ({
      name: entry.metadata.name,
      description: entry.metadata.description,
      jsonSchema: mcpSchemaToJsonSchema(entry.metadata.schema),
    }));
  }
}
