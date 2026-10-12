import type { McpToolRegistry } from './mcp-tool-registry';

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
 */
export function buildCapabilities(
  registry: McpToolRegistry,
  options?: { logging?: boolean; notifications?: boolean },
): Record<string, unknown> {
  const notifications = options?.notifications !== false;
  const capabilities: Record<string, unknown> = {};
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
