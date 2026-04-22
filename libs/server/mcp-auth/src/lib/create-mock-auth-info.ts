import type { McpAuthInfo } from '@onivoro/server-mcp';

/**
 * Factory for creating `McpAuthInfo` objects in tests.
 */
export function createMockAuthInfo(overrides?: Partial<McpAuthInfo>): McpAuthInfo {
  return {
    token: 'mock-token-' + Math.random().toString(36).slice(2),
    clientId: 'test-client',
    scopes: ['read'],
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  };
}
