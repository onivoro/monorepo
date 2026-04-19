export const MCP_MODULE_CONFIG = Symbol('MCP_MODULE_CONFIG');
export const MCP_STDIO_CONFIG = Symbol('MCP_STDIO_CONFIG');
export const MCP_TOOL_METADATA = Symbol('MCP_TOOL_METADATA');
export const MCP_RESOURCE_METADATA = Symbol('MCP_RESOURCE_METADATA');
export const MCP_PROMPT_METADATA = Symbol('MCP_PROMPT_METADATA');

export const MCP_CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Accept',
  'Authorization',
  'x-api-key',
  'Mcp-Session-Id',
  'Mcp-Protocol-Version',
  'Last-Event-ID',
];

export const MCP_CORS_EXPOSED_HEADERS = ['Mcp-Session-Id', 'Mcp-Protocol-Version'];

export const MCP_CORS_METHODS = ['GET', 'POST', 'DELETE', 'OPTIONS'];

export const MCP_CORS_CONFIG = {
  origin: true,
  credentials: true,
  methods: MCP_CORS_METHODS,
  allowedHeaders: MCP_CORS_ALLOWED_HEADERS,
  exposedHeaders: MCP_CORS_EXPOSED_HEADERS,
};
