export const MCP_CORS_EXPOSED_HEADERS = [
  'Mcp-Session-Id',
  'Mcp-Protocol-Version',
  // A browser client needs the bearer challenge to find the authorization server.
  'WWW-Authenticate',
];
