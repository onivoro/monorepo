import type { McpAuthConfig } from './mcp-auth-config';

export interface McpCognitoAuthConfig
  extends Pick<
    McpAuthConfig,
    | 'resourceServerUrl'
    | 'authorizationServers'
    | 'serveProtectedResourceMetadata'
    | 'protectedResourceMetadataMode'
    | 'resourceName'
    | 'resourceDocumentationUrl'
    | 'jwksCache'
    | 'jwksCacheMaxAge'
    | 'jwksRateLimit'
    | 'jwksRequestsPerMinute'
  > {
  region: string;
  userPoolId: string;
  clientId: string;
  /**
   * Other app clients of the same user pool whose access tokens
   * `McpCognitoAuthStrategy.verifyInProcessAccessToken()` accepts, e.g. the
   * web app client whose users' tokens an in-process agentic loop forwards.
   * The MCP route itself still accepts only `clientId`.
   */
  inProcessClientIds?: string[];
  extraClaims?: Record<string, string>;
}
