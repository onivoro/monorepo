export const DEFAULT_MCP_HTTP_ROUTE = 'mcp';

export function normalizeMcpHttpRoute(route?: string): string {
  if (route == null) return DEFAULT_MCP_HTTP_ROUTE;

  if (route.includes('?') || route.includes('#')) {
    throw new Error(`McpHttpModule route must be a path without query or fragment, got "${route}".`);
  }

  const normalized = normalizePath(route);
  if (!normalized) {
    throw new Error('McpHttpModule route must not be empty.');
  }

  const hasUnsafeSegment = normalized
    .split('/')
    .some((segment) => segment === '.' || segment === '..');

  if (hasUnsafeSegment) {
    throw new Error(`McpHttpModule route must not include "." or ".." segments, got "${route}".`);
  }

  return normalized;
}

export function normalizePath(path: string): string {
  return path
    .split('?')[0]
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join('/');
}
