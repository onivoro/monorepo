import 'reflect-metadata';
import { MCP_GUARD_METADATA } from './mcp-guard-metadata-token';
import type { McpCanActivate } from './mcp-can-activate';
import type { McpGuardMetadata } from './mcp-guard-metadata';

/**
 * Decorator that attaches a guard to an @McpTool method.
 * Guards run before hooks and the handler — if canActivate returns false, the call is rejected.
 *
 * Stackable: apply multiple @McpGuard decorators to run guards in order (top-down).
 *
 * @example
 * // Built-in scope check
 * @McpTool('delete-item', 'Delete an item', schema)
 * @McpGuard(McpScopeGuard, { scopes: ['write'] })
 * async deleteItem(params: { id: string }) { ... }
 *
 * @example
 * // Custom guard
 * @McpTool('admin-action', 'Admin only', schema)
 * @McpGuard(RateLimitGuard, { maxPerMinute: 10 })
 * @McpGuard(McpScopeGuard, { scopes: ['admin'] })
 * async adminAction(params: {}) { ... }
 */
export const McpGuard = (
  guardClass: new (...args: any[]) => McpCanActivate,
  config?: Record<string, unknown>,
) => {
  return (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) => {
    const existing: McpGuardMetadata[] =
      Reflect.getMetadata(MCP_GUARD_METADATA, descriptor.value) || [];
    Reflect.defineMetadata(
      MCP_GUARD_METADATA,
      [...existing, { guardClass, config }],
      descriptor.value,
    );
  };
};
