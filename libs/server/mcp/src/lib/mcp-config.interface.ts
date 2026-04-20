import type { ServerOptions } from '@modelcontextprotocol/sdk/server/index.js';

export interface McpServerMetadata {
  name: string;
  version: string;
  description?: string;
}

export interface McpModuleConfig {
  metadata: McpServerMetadata;
  serverOptions?: ServerOptions;
  routePrefix?: string;
  sessionTtlMinutes?: number;
  /**
   * Allowed Origin header values for DNS rebinding protection (MCP spec 2025-03-26+).
   *
   * When set, requests with an `Origin` header not in this list are rejected with 403.
   * Requests without an `Origin` header (non-browser MCP clients like Claude Desktop,
   * Claude Code, curl) are always allowed regardless of this setting.
   *
   * When not set, Origin validation is disabled (backward-compatible default).
   *
   * @example ['http://localhost:3000', 'https://my-app.example.com']
   */
  allowedOrigins?: string[];
}
