/**
 * Icon descriptor for MCP entities (spec 2025-11-25+).
 * Provides visual identity for tools, resources, and prompts in client UIs.
 */
export interface McpIcon {
  /** URL of the icon (HTTPS or data URI). */
  url: string;
  /** MIME type of the icon (e.g. 'image/svg+xml', 'image/png'). */
  mediaType?: string;
  /** Display size hint (e.g. '16x16', '32x32'). */
  size?: string;
}
