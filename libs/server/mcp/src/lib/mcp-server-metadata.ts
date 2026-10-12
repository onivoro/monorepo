export interface McpServerMetadata {
  name: string;
  version: string;
  description?: string;
  /** Human-readable instructions describing how to use the server. Sent in the `initialize` response (2025-era clients) and the `server/discover` result (2026-07-28). */
  instructions?: string;
}
