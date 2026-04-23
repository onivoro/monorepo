import type { McpIcon } from './mcp-icon';
import type { McpResourceAnnotations } from './mcp-resource-annotations';
import type { McpResourceListStrategy } from './mcp-resource-list-strategy';
import type { McpCompletionStrategy } from './mcp-completion-strategy';

export interface McpResourceMetadata {
  name: string;
  uri: string;
  /** Human-readable display name shown in MCP client UIs. */
  title?: string;
  description?: string;
  mimeType?: string;
  /** Size in bytes, helps clients decide whether to fetch large resources. */
  size?: number;
  /** Icons for client UI rendering (spec 2025-11-25+). */
  icons?: McpIcon[];
  /** Resource-level annotations (audience, priority, lastModified). */
  annotations?: McpResourceAnnotations;
  isTemplate?: boolean;
  /**
   * Injectable strategy that lists all resources matching this template. Only used when isTemplate is true.
   * Must implement `McpResourceListStrategy` and be decorated with `@Injectable()`.
   */
  listStrategy?: new (...args: any[]) => McpResourceListStrategy;
  /**
   * Injectable strategy for autocompletion of URI template variables. Only used when isTemplate is true.
   * Must implement `McpCompletionStrategy` and be decorated with `@Injectable()`.
   *
   * The strategy's `complete(argName, value, context)` method is called for each URI variable.
   */
  completeStrategy?: new (...args: any[]) => McpCompletionStrategy;
}
