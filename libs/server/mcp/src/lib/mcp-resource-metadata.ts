import type { McpIcon } from './mcp-icon';
import type { McpResourceAnnotations } from './mcp-resource-annotations';
import type { McpResourceListProvider } from './mcp-resource-list-provider';
import type { McpCompletionProvider } from './mcp-completion-provider';

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
   * Injectable provider that lists all resources matching this template. Only used when isTemplate is true.
   * Must implement `McpResourceListProvider` and be decorated with `@Injectable()`.
   */
  listProvider?: new (...args: any[]) => McpResourceListProvider;
  /**
   * Injectable provider for autocompletion of URI template variables. Only used when isTemplate is true.
   * Must implement `McpCompletionProvider` and be decorated with `@Injectable()`.
   *
   * The provider's `complete(argName, value, context)` method is called for each URI variable.
   */
  completeProvider?: new (...args: any[]) => McpCompletionProvider;
}
