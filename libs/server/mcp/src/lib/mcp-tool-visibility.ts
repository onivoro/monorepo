import type { McpAuthInfo } from './mcp-auth-info';
import type { McpToolMetadata } from './mcp-tool-metadata';

/**
 * Which tools a caller sees in `tools/list` (and can call).
 *
 * - `'all'`: every enabled tool, whoever asks. Guards still refuse calls they don't allow.
 * - `'authorized'`: a tool guarded by `McpScopeGuard` (or a subclass) is listed only to a
 *   caller whose auth carries every scope its `McpScopeGuard` guards require. Tools without
 *   an `McpScopeGuard` are listed to everyone. Other guards are not consulted; use
 *   `toolFilter` for rules of your own.
 */
export type McpToolVisibility = 'all' | 'authorized';

/**
 * Decides whether one caller sees one tool. `authInfo` is the caller's auth after the
 * configured `McpAuthStrategy` resolved it (the auth a guard sees), or `undefined` for an
 * unauthenticated caller. Return `true` to list the tool. A filter that throws or rejects
 * hides the tool.
 */
export type McpToolFilter = (
  tool: McpToolMetadata,
  authInfo: McpAuthInfo | undefined,
) => boolean | Promise<boolean>;

/**
 * Per-caller tool visibility, accepted by `McpHttpModule` and `McpStdioModule`, and by
 * `McpToolRegistry.setToolVisibility` for a custom transport.
 *
 * A tool is listed to a caller only if all of these hold:
 * 1. it is enabled (`setToolEnabled`), which applies to every caller;
 * 2. with `toolVisibility: 'authorized'`, the caller has the scopes its `McpScopeGuard`
 *    guards require;
 * 3. `toolFilter`, when set, returns `true`.
 *
 * So `toolFilter` narrows the scope rule when `toolVisibility` is `'authorized'`, and stands
 * alone when it is `'all'`. A tool a caller doesn't see isn't registered on the server that
 * serves that caller, so calling it fails as for a tool that doesn't exist.
 */
export interface McpToolVisibilityOptions {
  /** Default: `'all'`, which lists every enabled tool to every caller. */
  toolVisibility?: McpToolVisibility;
  /** Applied in addition to `toolVisibility`. Default: none. */
  toolFilter?: McpToolFilter;
}

/**
 * The tools one caller sees, from `McpToolRegistry.resolveVisibleTools(authInfo)`. Pass it
 * to `wireRegistryToServer` as `visibleTools` for the server that serves that caller.
 */
export interface McpVisibleTools {
  /** Whether the tool is visible, for tools registered when this was resolved. */
  has(name: string): boolean;
  /** Decides (once, then remembers) for a tool registered later. */
  evaluate(name: string): Promise<boolean>;
}
