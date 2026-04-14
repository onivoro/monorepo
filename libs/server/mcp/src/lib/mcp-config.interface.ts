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
}
