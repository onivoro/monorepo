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
 * Decided per request, from that request's auth after the auth strategy resolved it. A tool
 * is listed in a request's `tools/list`, and callable by its `tools/call`, only if all of
 * these hold:
 * 1. it is enabled (`setToolEnabled`), which applies to every caller;
 * 2. with `toolVisibility: 'authorized'`, the request has the scopes its `McpScopeGuard`
 *    guards require;
 * 3. `toolFilter`, when set, returns `true`.
 *
 * So `toolFilter` narrows the scope rule when `toolVisibility` is `'authorized'`, and stands
 * alone when it is `'all'`. A call to a tool the request may not see fails as for a tool that
 * doesn't exist (JSON-RPC `-32602`, `Tool <name> not found`).
 */
export interface McpToolVisibilityOptions {
  /** Default: `'all'`, which lists every enabled tool to every caller. */
  toolVisibility?: McpToolVisibility;
  /** Applied in addition to `toolVisibility`. Default: none. */
  toolFilter?: McpToolFilter;
}
