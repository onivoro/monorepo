import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpToolRegistry } from './mcp-tool-registry';

/**
 * Builds the MCP capabilities object from the current registry state.
 * Returns only the capability keys that have at least one registered entry.
 */
export function buildCapabilities(registry: McpToolRegistry): Record<string, unknown> {
  const capabilities: Record<string, unknown> = {};
  if (registry.getTools().length > 0) capabilities['tools'] = {};
  if (registry.getResources().length > 0) capabilities['resources'] = {};
  if (registry.getPrompts().length > 0) capabilities['prompts'] = {};
  return capabilities;
}

/**
 * Registers all tools, resources, and prompts from the registry onto an McpServer instance.
 *
 * This is the same wiring that McpHttpModule and McpStdioModule perform internally.
 * Use it when bringing your own transport via McpRegistryModule.registerOnly().
 */
export function wireRegistryToServer(registry: McpToolRegistry, server: McpServer): void {
  for (const { metadata } of registry.getTools()) {
    server.registerTool(
      metadata.name,
      { description: metadata.description, inputSchema: metadata.schema?.shape },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (params: any) => registry.executeToolWrapped(metadata.name, params) as any,
    );
  }

  for (const { metadata, handler } of registry.getResources()) {
    const resourceConfig: Record<string, string | undefined> = {};
    if (metadata.description) resourceConfig['description'] = metadata.description;
    if (metadata.mimeType) resourceConfig['mimeType'] = metadata.mimeType;

    if (metadata.isTemplate) {
      server.registerResource(metadata.name, new ResourceTemplate(metadata.uri, { list: undefined }), resourceConfig, handler);
    } else {
      server.registerResource(metadata.name, metadata.uri, resourceConfig, handler);
    }
  }

  for (const { metadata, handler } of registry.getPrompts()) {
    server.registerPrompt(metadata.name, { description: metadata.description, argsSchema: metadata.argsSchema }, handler);
  }
}
