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
  intercept(
    context: McpToolContext,
    next: () => Promise<unknown>,
  ): Promise<unknown>;
  /**
   * Called when a call is rejected before the interceptor chain runs: the auth strategy
   * threw, a guard denied it (`McpAccessDeniedError`), or the arguments failed validation.
   * `context.params` holds the arguments as received. Errors thrown here are logged and
   * ignored; the original error still rejects the call.
   */
  onRejected?(context: McpToolContext, error: unknown): Promise<void> | void;
}
