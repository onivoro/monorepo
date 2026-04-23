import { z } from 'zod';
import type { McpIcon } from './mcp-icon';
import type { McpCompletionStrategy } from './mcp-completion-strategy';

export interface McpPromptMetadata {
  name: string;
  /** Human-readable display name shown in MCP client UIs. */
  title?: string;
  description?: string;
  argsSchema?: Record<string, z.ZodTypeAny>;
  /** Icons for client UI rendering (spec 2025-11-25+). */
  icons?: McpIcon[];
  /**
   * Injectable strategy for autocompletion of prompt arguments.
   * Must implement `McpCompletionStrategy` and be decorated with `@Injectable()`.
   *
   * The strategy's `complete(argName, value, context)` method is called for each argument.
   */
  completeStrategy?: new (...args: any[]) => McpCompletionStrategy;
}
