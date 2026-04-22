export interface McpServerMetadata {
  name: string;
  version: string;
  description?: string;
  /** Human-readable instructions describing how to use the server. Included in the initialize response. */
  instructions?: string;
}
