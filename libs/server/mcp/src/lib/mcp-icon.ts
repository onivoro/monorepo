/**
 * Icon descriptor for MCP entities (spec 2025-11-25+).
 * Provides visual identity for tools, resources, and prompts in client UIs.
 */
export interface McpIcon {
  /** URL of the icon: `https:` or a `data:` URI. */
  src: string;
  /** MIME type of the icon (e.g. 'image/svg+xml', 'image/png'). */
  mimeType?: string;
  /** Sizes the icon is available in (e.g. ['16x16', '32x32'], or ['any'] for SVG). */
  sizes?: string[];
  /** The UI theme the icon is meant for. */
  theme?: 'light' | 'dark';
}
