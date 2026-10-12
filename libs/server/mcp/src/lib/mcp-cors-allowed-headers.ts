export const MCP_CORS_ALLOWED_HEADERS = [
  'Content-Type',
  'Accept',
  'Authorization',
  'x-api-key',
  'Mcp-Session-Id',
  'Mcp-Protocol-Version',
  'Last-Event-ID',
  // Sent with every 2026-07-28 request (SEP-2243).
  'Mcp-Method',
  'Mcp-Name',
];
