import type { McpAuthInfo } from './mcp-auth-info';

/**
 * Auth provider interface that runs before guards on every tool execution.
 * Implement as an `@Injectable()` NestJS service with full DI access.
 *
 * - Return an enriched `McpAuthInfo` to add decoded claims, roles, etc.
 * - Throw to reject the request (e.g., expired token).
 * - Return `undefined` to strip auth (anonymous access).
 */
export interface McpAuthProvider {
  resolveAuth(authInfo: McpAuthInfo | undefined): McpAuthInfo | undefined | Promise<McpAuthInfo | undefined>;
}
