/**
 * Behavioral hints for MCP clients (spec 2025-03-26+).
 * All fields are optional and advisory — clients MAY use them
 * for UX decisions (e.g. skipping confirmation for read-only tools).
 */
export interface McpToolAnnotations {
  /** Tool does not modify its environment. */
  readOnlyHint?: boolean;
  /** Tool may perform destructive updates (delete, overwrite). */
  destructiveHint?: boolean;
  /** Repeated calls with the same args have no additional effect. */
  idempotentHint?: boolean;
  /** Tool may interact with external entities (network, third-party APIs). */
  openWorldHint?: boolean;
}
