import type { McpAuthConfig } from './mcp-auth-config';

export interface McpCognitoAuthConfig extends Pick<
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
  extraClaims?: Record<string, string>;
}
