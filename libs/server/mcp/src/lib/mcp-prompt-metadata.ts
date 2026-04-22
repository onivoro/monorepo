import { z } from 'zod';
import type { McpIcon } from './mcp-icon';
import type { McpCompletionProvider } from './mcp-completion-provider';

export interface McpPromptMetadata {
  name: string;
  /** Human-readable display name shown in MCP client UIs. */
  title?: string;
  description?: string;
  argsSchema?: Record<string, z.ZodTypeAny>;
  /** Icons for client UI rendering (spec 2025-11-25+). */
  icons?: McpIcon[];
  /**
   * Injectable provider for autocompletion of prompt arguments.
   * Must implement `McpCompletionProvider` and be decorated with `@Injectable()`.
   *
   * The provider's `complete(argName, value, context)` method is called for each argument.
   */
  completeProvider?: new (...args: any[]) => McpCompletionProvider;
}
