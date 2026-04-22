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
  /** RFC 8707 resource indicator — the audience this token was issued for. */
  resource?: string;
  extra?: Record<string, unknown>;
}

/**
 * Context passed to tool handlers and interceptors during execution.
 */
export interface McpToolContext {
  toolName: string;
  params: Record<string, unknown>;
  metadata: McpToolMetadata;
  authInfo?: McpAuthInfo;
  /** MCP session identifier from the transport layer. */
  sessionId?: string;
  /** Abort signal — fires when the client cancels the request. */
  signal?: AbortSignal;
  /**
   * Send an incremental progress notification to the client.
   * Only available when the client requested progress tracking via `_meta.progressToken`.
   * No-op when progress is not supported for this request.
   */
  sendProgress?: (progress: number, total?: number, message?: string) => Promise<void>;
  /**
   * Send a structured log message to the MCP client.
   * Only available when the server is connected via a transport (HTTP/stdio).
   * The client controls the minimum log level via `logging/setLevel`.
   */
  sendLog?: (level: McpLogLevel, data: unknown, logger?: string) => Promise<void>;
  /**
   * Request LLM sampling from the client. Only available when the client supports sampling.
   * Sends a `sampling/createMessage` request to the client.
   */
  createMessage?: (params: Record<string, unknown>) => Promise<unknown>;
  /**
   * Request user input via an elicitation form or URL.
   * Only available when the client supports elicitation.
   */
  elicitInput?: (params: Record<string, unknown>) => Promise<unknown>;
  /**
   * Request the list of filesystem roots from the client.
   * Only available when the client supports roots.
   */
  listRoots?: () => Promise<unknown>;
}

/**
 * Interceptor interface for cross-cutting concerns around tool execution.
 * Modeled after the NestJS `NestInterceptor.intercept(context, next)` pattern.
 *
 * Implement as an injectable NestJS service and register via the registry.
 * Each interceptor wraps the next one in the chain; the innermost `next()`
 * calls the tool handler.
 */
export interface McpToolInterceptor {
  intercept(context: McpToolContext, next: () => Promise<unknown>): Promise<unknown>;
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
 * Auth provider interface that runs before guards on every tool execution.
 * Implement as an `@Injectable()` NestJS service with full DI access.
 *
 * - Return an enriched `McpAuthInfo` to add decoded claims, roles, etc.
 * - Throw to reject the request (e.g., expired token).
 * - Return `undefined` to strip auth (anonymous access).
 */
export interface McpAuthProvider {
  resolveAuth(authInfo: McpAuthInfo | undefined): McpAuthInfo | undefined | Promise<McpAuthInfo | undefined>;
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
  /** Optional structured output (JSON object) returned alongside content. */
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
  _meta?: Record<string, unknown>;
}

/** MCP logging levels (RFC 5424 severity + notice). */
export type McpLogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

export type McpRegistrationChangeType = 'tool' | 'resource' | 'prompt';
export type McpRegistrationChangeListener = (type: McpRegistrationChangeType, name: string) => void;

/** Listener called when `notifyResourceUpdated(uri)` is invoked. */
export type McpResourceUpdateListener = (uri: string) => void;

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
