import { Injectable, Logger } from '@nestjs/common';
import type { McpToolMetadata } from './mcp-tool-metadata';
import type { McpResourceMetadata } from './mcp-resource-metadata';
import type { McpPromptMetadata } from './mcp-prompt-metadata';
import type { McpAuthInfo } from './mcp-auth-info';
import { isMcpAuthInfoResolved } from './mcp-resolved-auth-info';
import type { McpToolContext } from './mcp-tool-context';
import type { McpToolInterceptor } from './mcp-tool-interceptor';
import type { McpCanActivate } from './mcp-can-activate';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import type { McpGuardMetadata } from './mcp-guard-metadata';
import type { McpToolResult } from './mcp-tool-result';
import type { McpToolExecutionExtra } from './mcp-tool-execution-extra';
import { isInputRequiredResult } from './is-input-required-result';
import type { McpRegistrationChangeType } from './mcp-registration-change-type';
import type { McpRegistrationChangeListener } from './mcp-registration-change-listener';
import type { McpResourceUpdateListener } from './mcp-resource-update-listener';
import { mcpSchemaToJsonSchema } from './mcp-schema-converters';
import { McpAccessDeniedError, McpToolError } from './mcp-tool-error';
import { McpScopeGuard } from './mcp-scope-guard';
import type {
  McpToolFilter,
  McpToolVisibility,
  McpToolVisibilityOptions,
  McpVisibleTools,
} from './mcp-tool-visibility';
import { ZodError } from 'zod';

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
  private readonly toolEnabledDelegates = new Set<
    (name: string, enabled: boolean) => void
  >();
  private readonly disabledTools = new Set<string>();
  private serverWired = false;
  private guardResolver?: (
    guardClass: new (...args: any[]) => McpCanActivate,
  ) => McpCanActivate;
  private providerResolver?: (cls: new (...args: any[]) => any) => any;
  private authStrategy?: McpAuthStrategy;
  private exposeErrorMessages = true;
  private toolVisibility: McpToolVisibility = 'all';
  private toolFilter?: McpToolFilter;

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
    resolver: (
      guardClass: new (...args: any[]) => McpCanActivate,
    ) => McpCanActivate,
  ): void {
    this.guardResolver = resolver;
  }

  /**
   * Whether `executeToolWrapped` returns the message of any error a tool throws to the client
   * (`true`, the current default), or only messages written for it — `McpToolError`s and
   * argument validation failures — replacing the rest with `Internal error` (`false`).
   * The default becomes `false` in the next major release.
   */
  setExposeErrorMessages(expose: boolean): void {
    this.exposeErrorMessages = expose;
  }

  /**
   * Which tools each caller sees: `McpHttpModule` and `McpStdioModule` set this from their
   * `toolVisibility` and `toolFilter` options. Call it yourself for a custom transport, and
   * pass `resolveVisibleTools(authInfo)` to `wireRegistryToServer`.
   */
  setToolVisibility(options: McpToolVisibilityOptions): void {
    const visibility = options.toolVisibility ?? 'all';
    if (visibility !== 'all' && visibility !== 'authorized') {
      throw new Error(
        `toolVisibility must be 'all' or 'authorized', got "${String(visibility)}".`,
      );
    }
    this.toolVisibility = visibility;
    this.toolFilter = options.toolFilter;
  }

  /** Whether some callers may see fewer tools than others (`setToolVisibility`). */
  hasToolVisibilityRules(): boolean {
    return this.toolVisibility === 'authorized' || !!this.toolFilter;
  }

  /**
   * Which tools a caller sees, or `undefined` when every caller sees every tool (no
   * visibility rules are set). `authInfo` is resolved with the auth strategy first, as for a
   * tool call, unless it was marked with `markMcpAuthInfoResolved`. If the strategy throws,
   * the caller is treated as unauthenticated. Pass auth that arrived over a transport as a
   * copy, as the transports do.
   */
  async resolveVisibleTools(
    authInfo?: McpAuthInfo,
  ): Promise<McpVisibleTools | undefined> {
    if (!this.hasToolVisibilityRules()) return undefined;

    let resolvedAuthInfo: McpAuthInfo | undefined;
    try {
      resolvedAuthInfo =
        this.authStrategy && !isMcpAuthInfoResolved(authInfo)
          ? await this.authStrategy.resolveAuth(authInfo)
          : authInfo;
    } catch (error) {
      this.logger.warn(
        `The auth strategy failed while deciding which tools to list, so only tools an unauthenticated caller may see are listed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      resolvedAuthInfo = undefined;
    }

    const decisions = new Map<string, Promise<boolean>>();
    const settled = new Map<string, boolean>();
    const evaluate = (name: string): Promise<boolean> => {
      let decision = decisions.get(name);
      if (!decision) {
        decision = this.isToolVisibleTo(name, resolvedAuthInfo).then(
          (visible) => {
            settled.set(name, visible);
            return visible;
          },
        );
        decisions.set(name, decision);
      }
      return decision;
    };
    await Promise.all(
      this.getTools().map(({ metadata }) => evaluate(metadata.name)),
    );

    return {
      has: (name) => settled.get(name) === true,
      evaluate,
    };
  }

  private async isToolVisibleTo(
    name: string,
    authInfo: McpAuthInfo | undefined,
  ): Promise<boolean> {
    const entry = this.tools.get(name);
    if (!entry) return false;

    if (this.toolVisibility === 'authorized') {
      const required = this.getToolRequiredScopes(name);
      if (
        required.length > 0 &&
        !required.every((scope) => authInfo?.scopes?.includes(scope))
      ) {
        return false;
      }
    }

    if (!this.toolFilter) return true;
    try {
      return (await this.toolFilter(entry.metadata, authInfo)) === true;
    } catch (error) {
      this.logger.error(
        `toolFilter failed for tool ${name}, so it is hidden:`,
        error,
      );
      return false;
    }
  }

  setAuthStrategy(strategy: McpAuthStrategy): void {
    this.authStrategy = strategy;
  }

  setProviderResolver(
    resolver: (cls: new (...args: any[]) => any) => any,
  ): void {
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
   * Add a delegate for enabling/disabling tools on an underlying McpServer.
   * Called by `wireRegistryToServer` (once per wired server) — consumers should use
   * `setToolEnabled()` instead. Returns a function that removes the delegate.
   */
  setToolEnabledDelegate(
    delegate: (name: string, enabled: boolean) => void,
  ): () => void {
    this.toolEnabledDelegates.add(delegate);
    this.serverWired = true;
    return () => {
      this.toolEnabledDelegates.delete(delegate);
    };
  }

  /**
   * Enable or disable a tool at runtime, on every wired server.
   * The state is remembered, so servers wired later (e.g. new HTTP sessions) start with it.
   * Disabled tools are hidden from `tools/list` and reject calls with "tool not found".
   * Requires a server to have been wired (via wireRegistryToServer, McpHttpModule, or McpStdioModule).
   */
  setToolEnabled(name: string, enabled: boolean): void {
    if (!this.tools.has(name)) {
      throw new Error(`MCP tool "${name}" is not registered.`);
    }
    if (!this.serverWired) {
      throw new Error(
        'No server wired. setToolEnabled requires an active transport (HTTP, stdio, or custom).',
      );
    }
    if (enabled) this.disabledTools.delete(name);
    else this.disabledTools.add(name);
    for (const delegate of this.toolEnabledDelegates) {
      delegate(name, enabled);
    }
  }

  /** Whether a tool is enabled (tools are enabled unless `setToolEnabled(name, false)` was called). */
  isToolEnabled(name: string): boolean {
    return !this.disabledTools.has(name);
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

  /**
   * The scopes a tool's `@McpGuard(McpScopeGuard, { scopes })` guards (including subclasses
   * of `McpScopeGuard`) require together, without duplicates. Empty for an unknown tool.
   */
  getToolRequiredScopes(name: string): string[] {
    const required = this.getToolGuards(name)
      .filter(
        ({ guardClass }) =>
          guardClass === McpScopeGuard ||
          guardClass.prototype instanceof McpScopeGuard,
      )
      .flatMap(({ config }) => (config?.['scopes'] as string[]) ?? []);
    return [...new Set(required)];
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
    extra?: McpToolExecutionExtra,
  ): Promise<unknown> {
    const entry = this.tools.get(name);
    if (!entry) {
      throw new McpToolError(`MCP tool "${name}" is not registered.`);
    }

    // Context for interceptors' `onRejected`, until the call gets past auth, guards and validation.
    const rejectionContext: McpToolContext = {
      toolName: name,
      params,
      metadata: entry.metadata,
      authInfo,
      era: extra?.era,
      sessionId: extra?.sessionId,
      signal: extra?.signal,
    };

    let context: McpToolContext;
    let validatedParams: Record<string, unknown>;
    try {
      // -- Auth strategy (enrichment/validation) --
      // Runs before guards so all guards receive a consistently resolved authInfo.
      // Auth info an in-process caller marked with `markMcpAuthInfoResolved` was
      // already verified, so only the guards below check it.
      const resolvedAuthInfo =
        this.authStrategy && !isMcpAuthInfoResolved(authInfo)
          ? await this.authStrategy.resolveAuth(authInfo)
          : authInfo;
      rejectionContext.authInfo = resolvedAuthInfo;

      // -- Guards (authorization) --
      // Run first with raw params. Guards check auth, not input shape.
      const guardContext: McpToolContext = {
        toolName: name,
        params,
        metadata: entry.metadata,
        authInfo: resolvedAuthInfo,
        ...extra,
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
            throw new McpAccessDeniedError(
              `Access denied by ${guardClass.name} for tool "${name}".`,
              guardClass.name,
            );
          }
        }
      }

      // -- Pipes (validation/transformation) --
      validatedParams = entry.metadata.schema
        ? entry.metadata.schema.parse(params)
        : params;

      context = { ...guardContext, params: validatedParams };
    } catch (error) {
      await this.notifyRejected(rejectionContext, error);
      throw error;
    }

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
    extra?: McpToolExecutionExtra,
  ): Promise<McpToolResult> {
    try {
      const result = await this.executeToolRaw(name, params, authInfo, extra);

      if (result && typeof result === 'object' && (result as any).content) {
        return result as McpToolResult;
      }

      // `inputRequired(...)`: the SDK asks the client and calls the tool again.
      if (isInputRequiredResult(result)) {
        return result as McpToolResult;
      }

      // A tool with an output schema must return structured content; a plain object
      // result is that content, with its JSON as the text for clients that ignore it.
      const structured =
        !!this.tools.get(name)?.metadata.outputSchema &&
        !!result &&
        typeof result === 'object' &&
        !Array.isArray(result);

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
        ...(structured && {
          structuredContent: result as Record<string, unknown>,
        }),
      };
    } catch (error) {
      this.logger.error(`Error executing tool ${name}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${clientErrorMessage(error, this.exposeErrorMessages)}`,
          },
        ],
        isError: true,
      };
    }
  }

  private async notifyRejected(
    context: McpToolContext,
    error: unknown,
  ): Promise<void> {
    for (const interceptor of this.interceptors) {
      if (!interceptor.onRejected) continue;
      try {
        await interceptor.onRejected(context, error);
      } catch (hookError) {
        this.logger.error(
          `Interceptor onRejected failed for tool ${context.toolName}:`,
          hookError,
        );
      }
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

/**
 * What the client may see of a failed tool call. Messages written for the client
 * (`McpToolError`) and argument validation failures, which the model needs to correct its
 * call, always pass through. Anything else could carry internal details, and is replaced
 * unless `expose` is set.
 */
function clientErrorMessage(error: unknown, expose: boolean): string {
  if (error instanceof McpToolError) return error.message;
  if (error instanceof ZodError) {
    return `Invalid arguments: ${error.issues
      .map((issue) =>
        issue.path.length
          ? `${issue.path.join('.')}: ${issue.message}`
          : issue.message,
      )
      .join('; ')}`;
  }
  if (expose) {
    return error instanceof Error ? error.message : 'Unknown error';
  }
  return 'Internal error';
}
