/**
 * Annotations for MCP resources (spec 2025-11-25+).
 */
export interface McpResourceAnnotations {
  /** Who the resource content is intended for. */
  audience?: Array<'user' | 'assistant'>;
  /** Relative priority (0.0-1.0). Higher = more important. */
  priority?: number;
  /** ISO 8601 timestamp of the last modification. */
  lastModified?: string;
}
