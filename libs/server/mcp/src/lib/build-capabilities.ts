import type { ServerCapabilities } from '@modelcontextprotocol/server';
import type { McpToolRegistry } from './mcp-tool-registry';
import type {
  McpExtraCapabilities,
  McpModuleCapabilityKey,
} from './mcp-server-base-config';

export const MODULE_CAPABILITY_KEYS: readonly McpModuleCapabilityKey[] = [
  'logging',
  'tools',
  'resources',
  'prompts',
];

/**
 * Builds the MCP capabilities object from the current registry state.
 * Returns only the capability keys that have at least one registered entry,
 * and advertises only what the transport can deliver.
 *
 * @param options.logging - Whether to advertise the `logging` capability. Defaults to `true`.
 *   Log messages are tied to the tool call that sends them, so only advertise this when the
 *   transport delivers request-scoped messages (stdio, or HTTP with SSE responses). Pass
 *   `false` for HTTP with JSON responses, or for registry-only consumers without a transport.
 * @param options.notifications - Whether to advertise `listChanged` and resource `subscribe`.
 *   Defaults to `true`. These notifications are not tied to a request, so they need a
 *   connection the server can write to at any time (stdio, or stateful HTTP). Pass `false`
 *   for stateless HTTP. Use the same value for `wireRegistryToServer`'s `unsolicitedMessages`.
 * @param options.extra - Further capabilities to advertise, such as `experimental` entries.
 *   The keys this function builds (`logging`, `tools`, `resources`, `prompts`) are ignored
 *   in `extra`: what the server sends for them follows the registry and the options above.
 */
export function buildCapabilities(
  registry: McpToolRegistry,
  options?: {
    logging?: boolean;
    notifications?: boolean;
    extra?: McpExtraCapabilities;
  },
): ServerCapabilities {
  const notifications = options?.notifications !== false;
  const capabilities: ServerCapabilities = {};
  for (const [key, value] of Object.entries(options?.extra ?? {})) {
    if (value === undefined) continue;
    if ((MODULE_CAPABILITY_KEYS as readonly string[]).includes(key)) continue;
    (capabilities as Record<string, unknown>)[key] = value;
  }
  if (options?.logging !== false) capabilities['logging'] = {};
  if (registry.getTools().length > 0) {
    capabilities['tools'] = { listChanged: notifications };
  }
  if (registry.getResources().length > 0) {
    capabilities['resources'] = {
      subscribe: notifications,
      listChanged: notifications,
    };
  }
  if (registry.getPrompts().length > 0) {
    capabilities['prompts'] = { listChanged: notifications };
  }
  return capabilities;
}
