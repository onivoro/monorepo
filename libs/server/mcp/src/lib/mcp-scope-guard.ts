import { Injectable } from '@nestjs/common';
import type { McpCanActivate } from './mcp-can-activate';
import type { McpToolContext } from './mcp-tool-context';

/**
 * Built-in guard that checks authInfo.scopes against a required scope list.
 * Pass `{ scopes: ['read', 'write'] }` as the config — all listed scopes must be present.
 *
 * @example
 * @McpTool({ name: 'delete-item', description: 'Delete an item', schema })
 * @McpGuard(McpScopeGuard, { scopes: ['write'] })
 * async deleteItem(params: { id: string }) { ... }
 */
@Injectable()
export class McpScopeGuard implements McpCanActivate {
  canActivate(
    context: McpToolContext,
    config?: Record<string, unknown>,
  ): boolean {
    const requiredScopes = config?.scopes as string[] | undefined;
    if (!requiredScopes?.length) return true;
    if (!context.authInfo) return false;
    return requiredScopes.every((scope) =>
      context.authInfo!.scopes.includes(scope),
    );
  }
}
