import type { McpToolContext } from './mcp-tool-context';

/**
 * Guard interface for per-tool authorization.
 * Implement as an injectable NestJS service and reference via @McpGuard().
 */
export interface McpCanActivate {
  canActivate(
    context: McpToolContext,
    config?: Record<string, unknown>,
  ): boolean | Promise<boolean>;
}
