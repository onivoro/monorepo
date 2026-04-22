/**
 * Authentication/authorization info from the MCP transport layer.
 * Compatible with the MCP SDK's AuthInfo but defined independently
 * so the core registry has no SDK dependency.
 */
export interface McpAuthInfo {
  token: string;
  clientId: string;
  scopes: string[];
  expiresAt?: number;
  /** RFC 8707 resource indicator — the audience this token was issued for. */
  resource?: string;
  extra?: Record<string, unknown>;
}
