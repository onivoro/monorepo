import {
  completable,
  isCompletable,
  McpServer,
  ProtocolError,
  ProtocolErrorCode,
  ResourceTemplate,
} from '@modelcontextprotocol/server';
import type {
  CallToolResult,
  RegisteredTool,
  ServerContext,
} from '@modelcontextprotocol/server';
import { isInputRequiredResult } from './is-input-required-result';
import { z } from 'zod';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpLogLevel } from './mcp-log-level';
import type { McpPromptMetadata } from './mcp-prompt-metadata';
import type { McpProtocolEra } from './mcp-protocol-era';
import type { McpHandlerContext } from './mcp-handler-context';
import { wrapResourceResult } from './wrap-resource-result';
import { wrapPromptResult } from './wrap-prompt-result';

/** The input schema of a tool that declares none: any object, passed through as is. */
const ANY_INPUT_SCHEMA = z.looseObject({});

/**
 * The tool's schema as the SDK sees it: advertised in `tools/list` as is, but with
 * validation left to the registry. The SDK would otherwise validate arguments before the
 * handler, ahead of the registry's auth strategy and guards (so an unauthorized caller
 * would learn the schema from its errors, and rejected calls would skip `onRejected`),
 * and transforms would run twice.
 */
function advertisedOnly(schema: z.ZodObject<any>) {
  const standard = (schema as any)['~standard'];
  return {
    '~standard': {
      version: 1,
      vendor: standard.vendor,
      validate: (value: unknown) => ({ value }),
      jsonSchema: standard.jsonSchema,
    },
  };
}

/**
 * What the server is for and what the transport it is connected to can deliver.
 * Every option has a default that holds for a long-lived 2025-era connection (stdio,
 * or a stateful HTTP session).
 */
export interface WireRegistryToServerOptions {
  /**
   * Whether messages tied to a request reach the client: progress, log messages, and
   * (on 2025-era connections) sampling, elicitation and roots requests sent while a tool
   * runs. True for stdio and for HTTP with SSE responses; false for HTTP with JSON
   * responses, which drops them. When false, `sendProgress`, `sendLog`, `createMessage`,
   * `elicitInput` and `listRoots` are left out of the tool context. Use the same value
   * as `buildCapabilities`' `logging`. Default: `true`.
   */
  requestScopedMessages?: boolean;
  /**
   * Whether list-changed and resource-updated notifications can reach the client. When
   * false, list changes and resource subscriptions are not advertised. Use the same value
   * as `buildCapabilities`' `notifications`. Default: `true`.
   */
  unsolicitedMessages?: boolean;
  /**
   * The protocol era of the connection the server serves. `'modern'` (spec 2026-07-28)
   * servers answer one request and have no channel for server-to-client requests, so
   * tools get no `createMessage`, `elicitInput` or `listRoots`; they ask for input by
   * returning `inputRequired(...)` instead. Default: `'legacy'`.
   */
  era?: McpProtocolEra;
  /**
   * Keep the server in step with the registry after wiring: register tools, resources and
   * prompts added later, apply `setToolEnabled`, and forward `notifyResourceUpdated` to
   * clients that subscribed on this connection. Turn off for a server that lives for one
   * request. Default: `true`.
   */
  followRegistry?: boolean;
}

/** Per-server state shared by everything wired onto that server. */
interface ServerWiring {
  requestScopedMessages: boolean;
  era: McpProtocolEra;
}

/**
 * Prompt argument schemas with the prompt's completion strategy attached, built once per
 * prompt. `completable()` marks the schema it is given and can't mark one twice, so each
 * prompt gets its own copies, made once and reused by every server it is wired onto.
 */
const completablePromptSchemas = new WeakMap<
  McpPromptMetadata,
  z.ZodObject<any>
>();

function buildSendProgress(
  ctx: ServerContext | undefined,
):
  | ((progress: number, total?: number, message?: string) => Promise<void>)
  | undefined {
  const progressToken = ctx?.mcpReq?._meta?.progressToken;
  if (progressToken == null) return undefined;

  // Sent through the request's own channel, so it goes out on that request's response stream.
  return async (progress: number, total?: number, message?: string) => {
    await ctx!.mcpReq.notify({
      method: 'notifications/progress',
      params: {
        progressToken,
        progress,
        ...(total != null && { total }),
        ...(message != null && { message }),
      },
    } as any);
  };
}

function buildSendLog(
  ctx: ServerContext | undefined,
):
  | ((level: McpLogLevel, data: unknown, logger?: string) => Promise<void>)
  | undefined {
  if (typeof ctx?.mcpReq?.log !== 'function') return undefined;
  // The SDK applies the level the client asked for: `logging/setLevel` on 2025-era
  // connections, the request's `logLevel` on 2026-07-28 ones (no level, no logs).
  return (level, data, logger) => ctx.mcpReq.log(level, data, logger);
}

/**
 * The deprecated server-to-client requests, for 2025-era connections whose client declared
 * the capability. `inputRequired(...)` reaches clients of both eras; prefer it.
 */
function buildClientRequests(
  server: McpServer,
  wiring: ServerWiring,
  ctx: ServerContext | undefined,
) {
  if (
    !wiring.requestScopedMessages ||
    wiring.era !== 'legacy' ||
    !ctx?.mcpReq
  ) {
    return {};
  }
  // A stateless HTTP server never sees the client's capabilities, so these stay unset there.
  const capabilities = server.server.getClientCapabilities();
  return {
    ...(capabilities?.sampling && {
      createMessage: (params: Record<string, unknown>) =>
        ctx.mcpReq.requestSampling(params as any),
    }),
    ...(capabilities?.elicitation && {
      elicitInput: (params: Record<string, unknown>) =>
        ctx.mcpReq.elicitInput(params as any),
    }),
    ...(capabilities?.roots && {
      listRoots: () => ctx.mcpReq.send({ method: 'roots/list' }),
    }),
  };
}

/** The library's context for resource and prompt handlers, from the SDK's request context. */
function handlerContext(
  ctx: ServerContext | undefined,
  era: McpProtocolEra,
): McpHandlerContext {
  const authInfo = ctx?.http?.authInfo;
  return {
    era,
    ...(authInfo && { authInfo: { ...(authInfo as any) } }),
    ...(ctx?.sessionId !== undefined && { sessionId: ctx.sessionId }),
    ...(ctx?.mcpReq?.signal && { signal: ctx.mcpReq.signal }),
    ...(ctx?.mcpReq?.inputResponses && {
      inputResponses: ctx.mcpReq.inputResponses,
    }),
    ...(ctx?.mcpReq?.requestState && {
      requestState: ctx.mcpReq.requestState,
    }),
  };
}

function wireToolToServer(
  registry: McpToolRegistry,
  server: McpServer,
  toolName: string,
  registeredTools: Map<string, RegisteredTool>,
  wiring: ServerWiring,
): void {
  const entry = registry.getTool(toolName);
  if (!entry) return;
  const { metadata } = entry;

  const registered = server.registerTool(
    metadata.name,
    {
      description: metadata.description,
      // Always a schema: without one the SDK calls the handler with only `ctx`, which
      // would arrive here as the params. The registry validates; see advertisedOnly.
      inputSchema: advertisedOnly(metadata.schema ?? ANY_INPUT_SCHEMA) as any,
      ...(metadata.outputSchema && { outputSchema: metadata.outputSchema }),
      ...(metadata.title && { title: metadata.title }),
      ...(metadata.annotations && { annotations: metadata.annotations }),
      ...(metadata.icons && { icons: metadata.icons }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (params: any, ctx: ServerContext) => {
      const authInfo = ctx?.http?.authInfo;
      return registry.executeToolWrapped(
        metadata.name,
        params,
        // A copy, so auth info from a transport is never trusted as already
        // resolved (see markMcpAuthInfoResolved).
        authInfo && { ...(authInfo as any) },
        {
          era: wiring.era,
          sessionId: ctx?.sessionId,
          signal: ctx?.mcpReq?.signal,
          inputResponses: ctx?.mcpReq?.inputResponses,
          ...(ctx?.mcpReq?.requestState && {
            requestState: ctx.mcpReq.requestState,
          }),
          ...(wiring.requestScopedMessages && {
            sendProgress: buildSendProgress(ctx),
            sendLog: buildSendLog(ctx),
          }),
          ...buildClientRequests(server, wiring, ctx),
        },
      ) as any;
    },
  );

  registeredTools.set(metadata.name, registered);
  if (!registry.isToolEnabled(metadata.name)) registered.disable();
}

function wireResourceToServer(
  registry: McpToolRegistry,
  server: McpServer,
  resourceName: string,
  wiring: ServerWiring,
): void {
  const entries = registry.getResources();
  const entry = entries.find((e) => e.metadata.name === resourceName);
  if (!entry) return;
  const { metadata, handler } = entry;

  const resourceConfig: Record<string, unknown> = {};
  if (metadata.title) resourceConfig['title'] = metadata.title;
  if (metadata.description)
    resourceConfig['description'] = metadata.description;
  if (metadata.mimeType) resourceConfig['mimeType'] = metadata.mimeType;
  if (metadata.size != null) resourceConfig['size'] = metadata.size;
  if (metadata.icons) resourceConfig['icons'] = metadata.icons;
  if (metadata.annotations)
    resourceConfig['annotations'] = metadata.annotations;

  if (metadata.isTemplate) {
    let listCallback: ((...args: any[]) => any) | undefined;
    if (metadata.listStrategy) {
      const provider = registry.resolveProvider(metadata.listStrategy);
      listCallback = () => provider.list();
    }

    let completeCallbacks:
      | Record<
          string,
          (value: string, context?: any) => string[] | Promise<string[]>
        >
      | undefined;
    if (metadata.completeStrategy) {
      const provider = registry.resolveProvider(metadata.completeStrategy);
      completeCallbacks = new Proxy({} as any, {
        get: (_target, prop: string | symbol) => {
          if (prop === 'then' || typeof prop !== 'string') return undefined;
          return (value: string, context?: any) =>
            provider.complete(prop, value, context);
        },
      });
    }

    server.registerResource(
      metadata.name,
      new ResourceTemplate(metadata.uri, {
        list: listCallback,
        ...(completeCallbacks && { complete: completeCallbacks }),
      }),
      resourceConfig,
      (async (uri: URL, variables: any, ctx: ServerContext) =>
        wrapResourceResult(
          await handler(uri, variables, handlerContext(ctx, wiring.era)),
          uri.href,
          metadata.mimeType,
        )) as any,
    );
  } else {
    server.registerResource(
      metadata.name,
      metadata.uri,
      resourceConfig,
      (async (uri: URL, ctx: ServerContext) =>
        wrapResourceResult(
          await handler(uri, handlerContext(ctx, wiring.era)),
          uri.href,
          metadata.mimeType,
        )) as any,
    );
  }
}

/**
 * The prompt's arguments as an object schema, with its `completeStrategy` attached to every
 * argument, the way the SDK reads prompt completions. Arguments the author already made
 * `completable()` keep their own completer.
 */
function promptArgsSchema(
  registry: McpToolRegistry,
  metadata: McpPromptMetadata,
): z.ZodObject<any> | undefined {
  const { argsSchema, completeStrategy } = metadata;
  if (!argsSchema) return undefined;

  let schema = completablePromptSchemas.get(metadata);
  if (!schema) {
    // Resolved now so a missing provider fails at wiring time, not on the first completion.
    const provider =
      completeStrategy && registry.resolveProvider(completeStrategy);
    schema = z.object(
      Object.fromEntries(
        Object.entries(argsSchema).map(([argName, field]) => [
          argName,
          !provider || isCompletable(field)
            ? field
            : completable(field.clone(), (value: unknown, context?: any) =>
                provider.complete(argName, String(value ?? ''), context),
              ),
        ]),
      ),
    );
    completablePromptSchemas.set(metadata, schema);
  }
  return schema;
}

function wirePromptToServer(
  registry: McpToolRegistry,
  server: McpServer,
  promptName: string,
  wiring: ServerWiring,
): void {
  const entries = registry.getPrompts();
  const entry = entries.find((e) => e.metadata.name === promptName);
  if (!entry) return;
  const { metadata, handler } = entry;
  const argsSchema = promptArgsSchema(registry, metadata);

  server.registerPrompt(
    metadata.name,
    {
      description: metadata.description,
      ...(argsSchema && { argsSchema: argsSchema as any }),
      ...(metadata.title && { title: metadata.title }),
      ...(metadata.icons && { icons: metadata.icons }),
    },
    // The SDK calls `(args, ctx)` for a prompt with arguments and `(ctx)` for one without.
    (async (...sdkArgs: any[]) => {
      const ctx = sdkArgs[sdkArgs.length - 1] as ServerContext | undefined;
      const context = handlerContext(ctx, wiring.era);
      return wrapPromptResult(
        await (argsSchema ? handler(sdkArgs[0], context) : handler(context)),
      );
    }) as any,
  );
}

/** The input schema of a tool listed without one, as the SDK lists it. */
const EMPTY_OBJECT_JSON_SCHEMA = { type: 'object', properties: {} };

/** A tool as `tools/list` describes it: the fields the SDK's own handler lists. */
function listedTool(server: McpServer, name: string, tool: RegisteredTool) {
  return {
    name,
    title: tool.title,
    description: tool.description,
    inputSchema: server.toolInputSchemaJson(name) ?? EMPTY_OBJECT_JSON_SCHEMA,
    annotations: tool.annotations,
    icons: tool.icons,
    execution: tool.execution,
    _meta: tool._meta,
    ...(tool.outputSchemaJson && { outputSchema: tool.outputSchemaJson }),
  };
}

/** The SDK's check of a tool's structured content against its output schema. */
async function validateToolOutput(
  name: string,
  tool: RegisteredTool,
  result: CallToolResult,
): Promise<void> {
  if (!tool.outputSchema || result.isError) return;
  if (result.structuredContent === undefined) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `Output validation error: Tool ${name} has an output schema but no structured content was provided`,
    );
  }
  const outcome = await tool.outputSchema['~standard'].validate(
    result.structuredContent,
  );
  if (outcome.issues?.length) {
    throw new ProtocolError(
      ProtocolErrorCode.InvalidParams,
      `Output validation error: Invalid structured content for tool ${name}: ${outcome.issues
        .map((issue) => issue.message)
        .join(', ')}`,
    );
  }
}

/**
 * Replaces the SDK's `tools/list` and `tools/call` handlers on `server` with ones that decide,
 * for each request, which tools it may see (`McpToolRegistry.setToolVisibility`), from the
 * request's own auth: `tools/list` lists only those, and `tools/call` answers a call to any
 * other tool as for a tool that doesn't exist. Every tool stays registered on the server, so
 * nothing about the server depends on who is calling. Otherwise the handlers do what the
 * SDK's do: hide and refuse disabled tools, call the tool's callback, check its structured
 * content against the output schema, and project the result for the client's era.
 *
 * The SDK installs its own handlers once, when the server gets the `tools` capability or its
 * first tool, and doesn't replace them later, so these are installed after the first tool is
 * registered on the server.
 */
function enforceToolVisibility(
  registry: McpToolRegistry,
  server: McpServer,
  tools: ReadonlyMap<string, RegisteredTool>,
): void {
  // Resolved once per request; the auth is a copy, so auth from a transport is never
  // trusted as already resolved (see markMcpAuthInfoResolved).
  const visibilityFor = (ctx: ServerContext | undefined) => {
    const authInfo = ctx?.http?.authInfo;
    return registry.resolveToolVisibility(authInfo && { ...(authInfo as any) });
  };

  server.server.setRequestHandler('tools/list', async (_request, ctx) => {
    const isVisible = await visibilityFor(ctx);
    // The tools registered once the request's auth is resolved, so none registered
    // meanwhile is missed.
    const listed = await Promise.all(
      [...tools].map(async ([name, tool]) =>
        tool.enabled && (!isVisible || (await isVisible(name)))
          ? listedTool(server, name, tool)
          : undefined,
      ),
    );
    return { tools: listed.filter((tool) => tool !== undefined) } as any;
  });

  server.server.setRequestHandler('tools/call', async (request, ctx) => {
    const name = request.params.name;
    const isVisible = await visibilityFor(ctx);
    const tool = tools.get(name);
    if (!tool || (isVisible && !(await isVisible(name)))) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        `Tool ${name} not found`,
      );
    }
    if (!tool.enabled) {
      throw new ProtocolError(
        ProtocolErrorCode.InvalidParams,
        `Tool ${name} disabled`,
      );
    }
    try {
      const result = (await (tool.handler as any)(
        request.params.arguments ?? {},
        ctx,
      )) as CallToolResult;
      if (isInputRequiredResult(result)) return result as any;
      await validateToolOutput(name, tool, result);
      return server.server.projectCallToolResult(
        result,
        tool.outputSchemaJson,
      ) as any;
    } catch (error) {
      if (
        error instanceof ProtocolError &&
        error.code === ProtocolErrorCode.UrlElicitationRequired
      ) {
        throw error;
      }
      return {
        content: [
          {
            type: 'text',
            text: error instanceof Error ? error.message : String(error),
          },
        ],
        isError: true,
      } as any;
    }
  });
}

/**
 * The SDK advertises `listChanged: true` for every kind it serves. Without a way to deliver
 * list changes, say no list changes or subscriptions instead. Capabilities are fixed once
 * the server connects, so a connected server is left as is.
 */
function withdrawUnsolicitedCapabilities(
  registry: McpToolRegistry,
  server: McpServer,
): void {
  if (server.isConnected()) return;
  server.server.registerCapabilities({
    ...(registry.getTools().length > 0 && { tools: { listChanged: false } }),
    ...(registry.getResources().length > 0 && {
      resources: { subscribe: false, listChanged: false },
    }),
    ...(registry.getPrompts().length > 0 && {
      prompts: { listChanged: false },
    }),
  });
}

/**
 * Registers all tools, resources, and prompts from the registry onto an McpServer instance,
 * and (unless `followRegistry` is off) keeps it in step with later registry changes.
 *
 * This is the same wiring that McpHttpModule and McpStdioModule perform internally.
 * Use it when bringing your own transport via McpRegistryModule.registerOnly(), and call it
 * before connecting the server. Describe the server in `options`.
 *
 * @returns A function that stops following the registry. Call it when the server closes.
 */
export function wireRegistryToServer(
  registry: McpToolRegistry,
  server: McpServer,
  options: WireRegistryToServerOptions = {},
): () => void {
  const unsolicitedMessages = options.unsolicitedMessages !== false;
  const followRegistry = options.followRegistry !== false;
  const wiring: ServerWiring = {
    requestScopedMessages: options.requestScopedMessages !== false,
    era: options.era ?? 'legacy',
  };

  const registeredTools = new Map<string, RegisteredTool>();

  // With visibility rules, each request sees only its own tools (enforced once the server
  // has a tool, and so the SDK's tool handlers to replace).
  const enforcesVisibility = registry.hasToolVisibilityRules();
  let enforcing = false;
  const wireTool = (name: string) => {
    wireToolToServer(registry, server, name, registeredTools, wiring);
    if (enforcesVisibility && !enforcing && registeredTools.size > 0) {
      enforcing = true;
      enforceToolVisibility(registry, server, registeredTools);
    }
  };

  for (const { metadata } of registry.getTools()) {
    wireTool(metadata.name);
  }

  for (const { metadata } of registry.getResources()) {
    wireResourceToServer(registry, server, metadata.name, wiring);
  }

  for (const { metadata } of registry.getPrompts()) {
    wirePromptToServer(registry, server, metadata.name, wiring);
  }

  if (!unsolicitedMessages) withdrawUnsolicitedCapabilities(registry, server);

  if (!followRegistry) return () => {};

  // Wire enable/disable delegate so registry.setToolEnabled() works.
  const unsubToolEnabled = registry.setToolEnabledDelegate((name, enabled) => {
    const registered = registeredTools.get(name);
    if (!registered) return;
    if (enabled) registered.enable();
    else registered.disable();
  });

  let unsubResourceUpdates = () => {};

  // 2025-era resource subscriptions. (2026-07-28 clients subscribe with
  // `subscriptions/listen`, which the SDK serves itself.)
  if (unsolicitedMessages && wiring.era === 'legacy') {
    // We track subscriptions on the registry (by session) and locally (per server, so
    // updates only go to clients that subscribed).
    const subscribedUris = new Set<string>();

    server.server.setRequestHandler('resources/subscribe', (request, ctx) => {
      const uri = request.params.uri;
      const sessionId = ctx?.sessionId;
      if (uri) subscribedUris.add(uri);
      if (uri && sessionId) {
        registry.subscribeResource(uri, sessionId);
      } else if (uri && !sessionId) {
        console.warn(
          `[wireRegistryToServer] Subscribe request for "${uri}" has no sessionId — subscription not tracked. This may indicate a transport bug.`,
        );
      }
      return {};
    });

    server.server.setRequestHandler('resources/unsubscribe', (request, ctx) => {
      const uri = request.params.uri;
      const sessionId = ctx?.sessionId;
      if (uri) subscribedUris.delete(uri);
      if (uri && sessionId) {
        registry.unsubscribeResource(uri, sessionId);
      } else if (uri && !sessionId) {
        console.warn(
          `[wireRegistryToServer] Unsubscribe request for "${uri}" has no sessionId — cannot remove subscription. This may indicate a transport bug.`,
        );
      }
      return {};
    });

    // Forward resource update notifications to the MCP client, if it subscribed to the URI.
    unsubResourceUpdates = registry.onResourceUpdate(async (uri) => {
      if (!subscribedUris.has(uri)) return;
      try {
        await server.server.sendResourceUpdated({ uri });
      } catch (err) {
        // Swallow errors — the client may have disconnected.
      }
    });
  }

  // A long-lived 2026-07-28 server (stdio) publishes every update; the SDK delivers it to
  // the `subscriptions/listen` streams whose filter names the URI.
  if (unsolicitedMessages && wiring.era === 'modern') {
    unsubResourceUpdates = registry.onResourceUpdate(async (uri) => {
      try {
        await server.server.sendResourceUpdated({ uri });
      } catch (err) {
        // Swallow errors — the client may have disconnected.
      }
    });
  }

  // Subscribe to future changes so dynamically registered items are wired automatically.
  // The SDK's registerTool/registerResource/registerPrompt send listChanged notifications.
  const unsubRegistrationChanges = registry.onRegistrationChange(
    (type, name) => {
      switch (type) {
        case 'tool':
          wireTool(name);
          break;
        case 'resource':
          wireResourceToServer(registry, server, name, wiring);
          break;
        case 'prompt':
          wirePromptToServer(registry, server, name, wiring);
          break;
      }
    },
  );

  return () => {
    unsubRegistrationChanges();
    unsubResourceUpdates();
    unsubToolEnabled();
  };
}
