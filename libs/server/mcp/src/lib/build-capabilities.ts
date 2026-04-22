import type { McpToolRegistry } from './mcp-tool-registry';

/**
 * Builds the MCP capabilities object from the current registry state.
 * Returns only the capability keys that have at least one registered entry.
 * Sets `listChanged: true` so clients know to expect dynamic updates.
 *
 * @param options.logging - Whether to advertise the `logging` capability. Defaults to `true`.
 *   Transport modules (HTTP, stdio) should leave this on. Registry-only consumers that
 *   don't attach a transport should pass `false` to avoid advertising a capability
 *   that cannot deliver.
 */
export function buildCapabilities(
  registry: McpToolRegistry,
  options?: { logging?: boolean },
): Record<string, unknown> {
  const capabilities: Record<string, unknown> = {};
  if (options?.logging !== false) capabilities['logging'] = {};
  if (registry.getTools().length > 0) capabilities['tools'] = { listChanged: true };
  if (registry.getResources().length > 0) capabilities['resources'] = { subscribe: true, listChanged: true };
  if (registry.getPrompts().length > 0) capabilities['prompts'] = { listChanged: true };
  return capabilities;
}
