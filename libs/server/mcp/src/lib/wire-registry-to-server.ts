import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SubscribeRequestSchema, UnsubscribeRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { McpToolRegistry, McpLogLevel } from './mcp-tool-registry';

/**
 * Builds the MCP capabilities object from the current registry state.
 * Returns only the capability keys that have at least one registered entry.
 * Sets `listChanged: true` so clients know to expect dynamic updates.
 */
export function buildCapabilities(registry: McpToolRegistry): Record<string, unknown> {
  const capabilities: Record<string, unknown> = { logging: {} };
  if (registry.getTools().length > 0) capabilities['tools'] = { listChanged: true };
  if (registry.getResources().length > 0) capabilities['resources'] = { subscribe: true, listChanged: true };
  if (registry.getPrompts().length > 0) capabilities['prompts'] = { listChanged: true };
  return capabilities;
}

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

function wireToolToServer(registry: McpToolRegistry, server: McpServer, toolName: string): void {
  const entry = registry.getTool(toolName);
  if (!entry) return;
  const { metadata } = entry;

  server.registerTool(
    metadata.name,
    {
      description: metadata.description,
      inputSchema: metadata.schema,
      ...(metadata.title && { title: metadata.title }),
      ...(metadata.annotations && { annotations: metadata.annotations }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (params: any, extra: any) =>
      registry.executeToolWrapped(metadata.name, params, extra?.authInfo, {
        sessionId: extra?.sessionId,
        signal: extra?.signal,
        sendProgress: buildSendProgress(server, extra),
        sendLog: (level: McpLogLevel, data: unknown, logger?: string) =>
          server.sendLoggingMessage({ level, data, ...(logger != null && { logger }) }),
      }) as any,
  );
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

  if (metadata.isTemplate) {
    server.registerResource(
      metadata.name,
      new ResourceTemplate(metadata.uri, {
        list: metadata.listCallback ?? undefined,
        ...(metadata.completeCallbacks && { complete: metadata.completeCallbacks }),
      }),
      resourceConfig,
      handler,
    );
  } else {
    server.registerResource(metadata.name, metadata.uri, resourceConfig, handler);
  }
}

function wirePromptToServer(registry: McpToolRegistry, server: McpServer, promptName: string): void {
  const entries = registry.getPrompts();
  const entry = entries.find((e) => e.metadata.name === promptName);
  if (!entry) return;
  const { metadata, handler } = entry;

  server.registerPrompt(
    metadata.name,
    {
      description: metadata.description,
      argsSchema: metadata.argsSchema,
      ...(metadata.title && { title: metadata.title }),
    },
    handler,
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
  for (const { metadata } of registry.getTools()) {
    wireToolToServer(registry, server, metadata.name);
  }

  for (const { metadata } of registry.getResources()) {
    wireResourceToServer(registry, server, metadata.name);
  }

  for (const { metadata } of registry.getPrompts()) {
    wirePromptToServer(registry, server, metadata.name);
  }

  // Wire resource subscription handlers on the low-level Server.
  // The SDK doesn't auto-handle subscribe/unsubscribe — we track subscriptions on the registry.
  server.server.setRequestHandler(SubscribeRequestSchema, (request, extra) => {
    const uri = request.params.uri;
    const sessionId = (extra as any)?.sessionId;
    if (uri && sessionId) {
      registry.subscribeResource(uri, sessionId);
    }
    return {};
  });

  server.server.setRequestHandler(UnsubscribeRequestSchema, (request, extra) => {
    const uri = request.params.uri;
    const sessionId = (extra as any)?.sessionId;
    if (uri && sessionId) {
      registry.unsubscribeResource(uri, sessionId);
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
        wireToolToServer(registry, server, name);
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
