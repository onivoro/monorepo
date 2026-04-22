import { Injectable, Logger } from '@nestjs/common';
import type { McpToolMetadata } from './mcp-tool-metadata';
import type { McpResourceMetadata } from './mcp-resource-metadata';
import type { McpPromptMetadata } from './mcp-prompt-metadata';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpToolContext } from './mcp-tool-context';
import type { McpToolInterceptor } from './mcp-tool-interceptor';
import type { McpCanActivate } from './mcp-can-activate';
import type { McpAuthProvider } from './mcp-auth-provider';
import type { McpGuardMetadata } from './mcp-guard-metadata';
import type { McpToolResult } from './mcp-tool-result';
import type { McpLogLevel } from './mcp-log-level';
import type { McpRegistrationChangeType } from './mcp-registration-change-type';
import type { McpRegistrationChangeListener } from './mcp-registration-change-listener';
import type { McpResourceUpdateListener } from './mcp-resource-update-listener';
import { mcpSchemaToJsonSchema } from './mcp-schema-converters';

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

@Injectable()
export class McpToolRegistry {
  private readonly logger = new Logger(McpToolRegistry.name);

  private readonly tools = new Map<string, ToolEntry>();
  private readonly resources = new Map<string, ResourceEntry>();
  private readonly prompts = new Map<string, PromptEntry>();
  private readonly interceptors: McpToolInterceptor[] = [];
  private readonly changeListeners: McpRegistrationChangeListener[] = [];
  private readonly resourceSubscriptions = new Map<string, Set<string>>();
  private readonly resourceUpdateListeners: McpResourceUpdateListener[] = [];
  private toolEnabledDelegate?: (name: string, enabled: boolean) => void;
  private guardResolver?: (guardClass: new (...args: any[]) => McpCanActivate) => McpCanActivate;
  private providerResolver?: (cls: new (...args: any[]) => any) => any;
  private authProvider?: McpAuthProvider;

  // -- Registration --

  /** Subscribe to registration changes for dynamic wiring. Returns an unsubscribe function. */
  onRegistrationChange(listener: McpRegistrationChangeListener): () => void {
    this.changeListeners.push(listener);
    return () => {
      const idx = this.changeListeners.indexOf(listener);
      if (idx >= 0) this.changeListeners.splice(idx, 1);
    };
  }

  private notifyChange(type: McpRegistrationChangeType, name: string): void {
    for (const listener of this.changeListeners) {
      try {
        listener(type, name);
      } catch (err) {
        this.logger.error(`Registration change listener error:`, err);
      }
    }
  }

  // -- Resource Subscriptions --

  /** Track a client subscribing to updates for a resource URI. */
  subscribeResource(uri: string, sessionId: string): void {
    let sessions = this.resourceSubscriptions.get(uri);
    if (!sessions) {
      sessions = new Set();
      this.resourceSubscriptions.set(uri, sessions);
    }
    sessions.add(sessionId);
  }

  /** Remove a client subscription for a resource URI. */
  unsubscribeResource(uri: string, sessionId: string): void {
    const sessions = this.resourceSubscriptions.get(uri);
    if (sessions) {
      sessions.delete(sessionId);
      if (sessions.size === 0) this.resourceSubscriptions.delete(uri);
    }
  }

  /** Get all session IDs subscribed to a resource URI. */
  getResourceSubscribers(uri: string): ReadonlySet<string> {
    return this.resourceSubscriptions.get(uri) ?? new Set();
  }

  /**
   * Notify all subscribers that a resource has been updated.
   * Call this from your application code when a resource's data changes.
   */
  notifyResourceUpdated(uri: string): void {
    for (const listener of this.resourceUpdateListeners) {
      try {
        listener(uri);
      } catch (err) {
        this.logger.error(`Resource update listener error:`, err);
      }
    }
  }

  /** Subscribe to resource update notifications. Returns an unsubscribe function. */
  onResourceUpdate(listener: McpResourceUpdateListener): () => void {
    this.resourceUpdateListeners.push(listener);
    return () => {
      const idx = this.resourceUpdateListeners.indexOf(listener);
      if (idx >= 0) this.resourceUpdateListeners.splice(idx, 1);
    };
  }

  /** Remove all subscriptions for a given session (e.g., on disconnect). */
  removeSessionSubscriptions(sessionId: string): void {
    for (const [uri, sessions] of this.resourceSubscriptions) {
      sessions.delete(sessionId);
      if (sessions.size === 0) this.resourceSubscriptions.delete(uri);
    }
  }

  registerInterceptor(interceptor: McpToolInterceptor): void {
    this.interceptors.push(interceptor);
  }

  setGuardResolver(
    resolver: (guardClass: new (...args: any[]) => McpCanActivate) => McpCanActivate,
  ): void {
    this.guardResolver = resolver;
  }

  setAuthProvider(provider: McpAuthProvider): void {
    this.authProvider = provider;
  }

  setProviderResolver(resolver: (cls: new (...args: any[]) => any) => any): void {
    this.providerResolver = resolver;
  }

  resolveProvider<T>(cls: new (...args: any[]) => T): T {
    if (!this.providerResolver) {
      throw new Error(
        'No provider resolver set. Ensure the module supports provider resolution.',
      );
    }
    return this.providerResolver(cls);
  }

  /**
   * Set a delegate for enabling/disabling tools on the underlying McpServer.
   * Called by `wireRegistryToServer` — consumers should use `setToolEnabled()` instead.
   */
  setToolEnabledDelegate(delegate: (name: string, enabled: boolean) => void): void {
    this.toolEnabledDelegate = delegate;
  }

  /**
   * Enable or disable a tool at runtime.
   * Disabled tools are hidden from `tools/list` and reject calls with "tool not found".
   * Requires a wired server (via wireRegistryToServer, McpHttpModule, or McpStdioModule).
   */
  setToolEnabled(name: string, enabled: boolean): void {
    if (!this.tools.has(name)) {
      throw new Error(`MCP tool "${name}" is not registered.`);
    }
    if (!this.toolEnabledDelegate) {
      throw new Error(
        'No server wired. setToolEnabled requires an active transport (HTTP, stdio, or custom).',
      );
    }
    this.toolEnabledDelegate(name, enabled);
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
    this.notifyChange('tool', metadata.name);
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
    this.notifyChange('resource', metadata.name);
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
    this.notifyChange('prompt', metadata.name);
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

  /** Returns the guard metadata for a registered tool, or an empty array if not found. */
  getToolGuards(name: string): ReadonlyArray<McpGuardMetadata> {
    return this.tools.get(name)?.guards ?? [];
  }

  // -- Execution --

  async executeToolRaw(
    name: string,
    params: Record<string, unknown>,
    authInfo?: McpAuthInfo,
    extra?: {
      sessionId?: string;
      signal?: AbortSignal;
      sendProgress?: (progress: number, total?: number, message?: string) => Promise<void>;
      sendLog?: (level: McpLogLevel, data: unknown, logger?: string) => Promise<void>;
      createMessage?: (params: Record<string, unknown>) => Promise<unknown>;
      elicitInput?: (params: Record<string, unknown>) => Promise<unknown>;
      listRoots?: () => Promise<unknown>;
    },
  ): Promise<unknown> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new Error(`MCP tool "${name}" is not registered.`);
    }

    // -- Auth provider (enrichment/validation) --
    // Runs before guards so all guards receive a consistently resolved authInfo.
    const resolvedAuthInfo = this.authProvider
      ? await this.authProvider.resolveAuth(authInfo)
      : authInfo;

    // -- Guards (authorization) --
    // Run first with raw params. Guards check auth, not input shape.
    const guardContext: McpToolContext = {
      toolName: name,
      params,
      metadata: entry.metadata,
      authInfo: resolvedAuthInfo,
      sessionId: extra?.sessionId,
      signal: extra?.signal,
      sendProgress: extra?.sendProgress,
      sendLog: extra?.sendLog,
      createMessage: extra?.createMessage,
      elicitInput: extra?.elicitInput,
      listRoots: extra?.listRoots,
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
      authInfo: resolvedAuthInfo,
      sessionId: extra?.sessionId,
      signal: extra?.signal,
      sendProgress: extra?.sendProgress,
      sendLog: extra?.sendLog,
      createMessage: extra?.createMessage,
      elicitInput: extra?.elicitInput,
      listRoots: extra?.listRoots,
    };

    // -- Interceptors --
    // Build the chain from the inside out: the innermost `next` calls the handler,
    // each interceptor wraps the next one. This mirrors NestJS interceptor chaining.
    const handler = () => entry.handler(validatedParams, context);

    const chain = this.interceptors.reduceRight<() => Promise<unknown>>(
      (next, interceptor) => () => interceptor.intercept(context, next),
      handler,
    );

    return chain();
  }

  async executeToolWrapped(
    name: string,
    params: Record<string, unknown>,
    authInfo?: McpAuthInfo,
    extra?: {
      sessionId?: string;
      signal?: AbortSignal;
      sendProgress?: (progress: number, total?: number, message?: string) => Promise<void>;
      sendLog?: (level: McpLogLevel, data: unknown, logger?: string) => Promise<void>;
      createMessage?: (params: Record<string, unknown>) => Promise<unknown>;
      elicitInput?: (params: Record<string, unknown>) => Promise<unknown>;
      listRoots?: () => Promise<unknown>;
    },
  ): Promise<McpToolResult> {
    try {
      const result = await this.executeToolRaw(name, params, authInfo, extra);

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
        isError: true,
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
