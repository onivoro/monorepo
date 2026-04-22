import type { McpCanActivate } from './mcp-can-activate';

/**
 * Metadata attached by the @McpGuard decorator.
 */
export interface McpGuardMetadata {
  guardClass: new (...args: any[]) => McpCanActivate;
  config?: Record<string, unknown>;
}
