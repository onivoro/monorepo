import { MCP_CORS_METHODS } from './mcp-cors-methods';
import { MCP_CORS_ALLOWED_HEADERS } from './mcp-cors-allowed-headers';
import { MCP_CORS_EXPOSED_HEADERS } from './mcp-cors-exposed-headers';

export const MCP_CORS_CONFIG = {
  origin: true,
  credentials: true,
  methods: MCP_CORS_METHODS,
  allowedHeaders: MCP_CORS_ALLOWED_HEADERS,
  exposedHeaders: MCP_CORS_EXPOSED_HEADERS,
};
