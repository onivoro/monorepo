import type { McpToolContext } from './mcp-tool-context';

/**
 * Interceptor interface for cross-cutting concerns around tool execution.
 * Modeled after the NestJS `NestInterceptor.intercept(context, next)` pattern.
 *
 * Implement as an injectable NestJS service and register via the registry.
 * Each interceptor wraps the next one in the chain; the innermost `next()`
 * calls the tool handler.
 */
export interface McpToolInterceptor {
  intercept(context: McpToolContext, next: () => Promise<unknown>): Promise<unknown>;
}
