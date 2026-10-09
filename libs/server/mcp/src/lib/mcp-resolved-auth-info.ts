import type { McpAuthInfo } from './mcp-auth-info';

// Membership cannot be forged from JSON, token claims or `extra`, and is not
// carried by copies, so only the object a trusted caller marked is trusted.
const resolvedAuthInfos = new WeakSet<McpAuthInfo>();

/**
 * Marks `authInfo` as already verified and enriched, so
 * `McpToolRegistry.executeToolRaw` passes it to guards without running the
 * registered `McpAuthStrategy`. Guards still run.
 *
 * For in-process callers (e.g. an agentic loop) that verified a token another
 * way than the strategy would. Mark the final object and pass that same object
 * on: a copy, such as `{ ...authInfo }`, is not marked. Auth info arriving over
 * an MCP transport is never trusted this way.
 */
export function markMcpAuthInfoResolved<TAuthInfo extends McpAuthInfo>(
  authInfo: TAuthInfo,
): TAuthInfo {
  resolvedAuthInfos.add(authInfo);
  return authInfo;
}

export function isMcpAuthInfoResolved(
  authInfo: McpAuthInfo | undefined,
): boolean {
  return !!authInfo && resolvedAuthInfos.has(authInfo);
}
