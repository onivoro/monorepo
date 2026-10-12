import type { McpToolContext } from './mcp-tool-context';

/**
 * Transport-level context for a tool call: everything in `McpToolContext` that doesn't
 * come from the registry itself. `wireRegistryToServer` fills it from the MCP SDK's
 * request context; in-process callers pass what they have.
 */
export type McpToolExecutionExtra = Omit<
  McpToolContext,
  'toolName' | 'params' | 'metadata' | 'authInfo'
>;
