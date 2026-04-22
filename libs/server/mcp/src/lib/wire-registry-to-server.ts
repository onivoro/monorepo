import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SubscribeRequestSchema, UnsubscribeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpLogLevel } from './mcp-log-level';
import { wrapResourceResult } from './wrap-resource-result';
import { wrapPromptResult } from './wrap-prompt-result';

function buildSendProgress(
  server: McpServer,
  extra: any,
): ((progress: number, total?: number, message?: string) => Promise<void>) | undefined {
  const progressToken = extra?._meta?.progressToken;
  if (progressToken == null) return undefined;

  return async (progress: number, total?: number, message?: string) => {
    await server.server.notification({
      method: 'notifications/progress' as const,
      params: {
        progressToken,
        progress,
        ...(total != null && { total }),
        ...(message != null && { message }),
      },
    } as any);
  };
}

function wireToolToServer(
  registry: McpToolRegistry,
  server: McpServer,
  toolName: string,
  registeredTools: Map<string, { enable(): void; disable(): void }>,
): void {
  const entry = registry.getTool(toolName);
  if (!entry) return;
  const { metadata } = entry;

  const registered = server.registerTool(
    metadata.name,
    {
      description: metadata.description,
      inputSchema: metadata.schema,
      ...(metadata.outputSchema && { outputSchema: metadata.outputSchema }),
      ...(metadata.title && { title: metadata.title }),
      ...(metadata.annotations && { annotations: metadata.annotations }),
      ...(metadata.icons && { icons: metadata.icons }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (params: any, extra: any) =>
      registry.executeToolWrapped(metadata.name, params, extra?.authInfo, {
        sessionId: extra?.sessionId,
        signal: extra?.signal,
        sendProgress: buildSendProgress(server, extra),
        sendLog: (level: McpLogLevel, data: unknown, logger?: string) =>
          server.sendLoggingMessage({ level, data, ...(logger != null && { logger }) }),
        createMessage: (msgParams: Record<string, unknown>) =>
          server.server.createMessage(msgParams as any, { signal: extra?.signal }),
        elicitInput: (elicitParams: Record<string, unknown>) =>
          server.server.elicitInput(elicitParams as any, { signal: extra?.signal }),
        listRoots: () => server.server.listRoots(undefined, { signal: extra?.signal }),
      }) as any,
  );

  registeredTools.set(metadata.name, registered as any);
}

function wireResourceToServer(registry: McpToolRegistry, server: McpServer, resourceName: string): void {
  const entries = registry.getResources();
  const entry = entries.find((e) => e.metadata.name === resourceName);
  if (!entry) return;
  const { metadata, handler } = entry;

  const resourceConfig: Record<string, unknown> = {};
  if (metadata.title) resourceConfig['title'] = metadata.title;
  if (metadata.description) resourceConfig['description'] = metadata.description;
  if (metadata.mimeType) resourceConfig['mimeType'] = metadata.mimeType;
  if (metadata.size != null) resourceConfig['size'] = metadata.size;
  if (metadata.icons) resourceConfig['icons'] = metadata.icons;
  if (metadata.annotations) resourceConfig['annotations'] = metadata.annotations;

  if (metadata.isTemplate) {
    let listCallback: ((...args: any[]) => any) | undefined;
    if (metadata.listProvider) {
      const provider = registry.resolveProvider(metadata.listProvider);
      listCallback = () => provider.list();
    }

    let completeCallbacks: Record<string, (value: string, context?: any) => string[] | Promise<string[]>> | undefined;
    if (metadata.completeProvider) {
      const provider = registry.resolveProvider(metadata.completeProvider);
      completeCallbacks = new Proxy({} as any, {
        get: (_target, prop: string | symbol) => {
          if (prop === 'then' || typeof prop !== 'string') return undefined;
          return (value: string, context?: any) => provider.complete(prop, value, context);
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
      (async (uri: URL, variables: any, extra: any) =>
        wrapResourceResult(await handler(uri, variables, extra), uri.href, metadata.mimeType)) as any,
    );
  } else {
    server.registerResource(
      metadata.name,
      metadata.uri,
      resourceConfig,
      (async (uri: URL, extra: any) =>
        wrapResourceResult(await handler(uri, extra), uri.href, metadata.mimeType)) as any,
    );
  }
}

function wirePromptToServer(registry: McpToolRegistry, server: McpServer, promptName: string): void {
  const entries = registry.getPrompts();
  const entry = entries.find((e) => e.metadata.name === promptName);
  if (!entry) return;
  const { metadata, handler } = entry;

  let completeCallbacks: Record<string, (value: string, context?: any) => string[] | Promise<string[]>> | undefined;
  if (metadata.completeProvider) {
    const provider = registry.resolveProvider(metadata.completeProvider);
    completeCallbacks = new Proxy({} as any, {
      get: (_target, prop: string | symbol) => {
        if (prop === 'then' || typeof prop !== 'string') return undefined;
        return (value: string, context?: any) => provider.complete(prop, value, context);
      },
    });
  }

  server.registerPrompt(
    metadata.name,
    {
      description: metadata.description,
      argsSchema: metadata.argsSchema,
      ...(metadata.title && { title: metadata.title }),
      ...(metadata.icons && { icons: metadata.icons }),
      ...(completeCallbacks && { complete: completeCallbacks }),
    },
    (async (...args: any[]) => wrapPromptResult(await handler(...args))) as any,
  );
}

/**
 * Registers all tools, resources, and prompts from the registry onto an McpServer instance.
 * Also subscribes to future registration changes for dynamic wiring.
 *
 * This is the same wiring that McpHttpModule and McpStdioModule perform internally.
 * Use it when bringing your own transport via McpRegistryModule.registerOnly().
 *
 * @returns An unsubscribe function to stop listening for registration changes.
 */
export function wireRegistryToServer(registry: McpToolRegistry, server: McpServer): () => void {
  const registeredTools = new Map<string, { enable(): void; disable(): void }>();

  for (const { metadata } of registry.getTools()) {
    wireToolToServer(registry, server, metadata.name, registeredTools);
  }

  for (const { metadata } of registry.getResources()) {
    wireResourceToServer(registry, server, metadata.name);
  }

  for (const { metadata } of registry.getPrompts()) {
    wirePromptToServer(registry, server, metadata.name);
  }

  // Wire enable/disable delegate so registry.setToolEnabled() works.
  registry.setToolEnabledDelegate((name, enabled) => {
    const registered = registeredTools.get(name);
    if (!registered) return;
    if (enabled) registered.enable();
    else registered.disable();
  });

  // Wire resource subscription handlers on the low-level Server.
  // The SDK doesn't auto-handle subscribe/unsubscribe — we track subscriptions on the registry.
  server.server.setRequestHandler(SubscribeRequestSchema, (request, extra) => {
    const uri = request.params.uri;
    const sessionId = (extra as any)?.sessionId;
    if (uri && sessionId) {
      registry.subscribeResource(uri, sessionId);
    } else if (uri && !sessionId) {
      console.warn(`[wireRegistryToServer] Subscribe request for "${uri}" has no sessionId — subscription not tracked. This may indicate a transport bug.`);
    }
    return {};
  });

  server.server.setRequestHandler(UnsubscribeRequestSchema, (request, extra) => {
    const uri = request.params.uri;
    const sessionId = (extra as any)?.sessionId;
    if (uri && sessionId) {
      registry.unsubscribeResource(uri, sessionId);
    } else if (uri && !sessionId) {
      console.warn(`[wireRegistryToServer] Unsubscribe request for "${uri}" has no sessionId — cannot remove subscription. This may indicate a transport bug.`);
    }
    return {};
  });

  // Forward resource update notifications to the MCP client.
  const unsubResourceUpdates = registry.onResourceUpdate(async (uri) => {
    try {
      await server.server.sendResourceUpdated({ uri });
    } catch (err) {
      // Swallow errors — the client may have disconnected.
    }
  });

  // Subscribe to future changes so dynamically registered items are wired automatically.
  // The SDK's registerTool/registerResource/registerPrompt send listChanged notifications.
  const unsubRegistrationChanges = registry.onRegistrationChange((type, name) => {
    switch (type) {
      case 'tool':
        wireToolToServer(registry, server, name, registeredTools);
        break;
      case 'resource':
        wireResourceToServer(registry, server, name);
        break;
      case 'prompt':
        wirePromptToServer(registry, server, name);
        break;
    }
  });

  return () => {
    unsubRegistrationChanges();
    unsubResourceUpdates();
  };
}
