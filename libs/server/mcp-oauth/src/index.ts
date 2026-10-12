/**
 * @deprecated `@onivoro/server-mcp-oauth` is deprecated. Run a dedicated authorization server
 * and validate its tokens with `@onivoro/server-mcp-auth`. See the package README.
 */
export { McpOAuthModule } from './lib/mcp-oauth.module';
export { McpOAuthConfig } from './lib/mcp-oauth-config';
export { McpOAuthAsyncOptions } from './lib/mcp-oauth-async-options';
export { MCP_OAUTH_CONFIG } from './lib/mcp-oauth-config-token';
export { MCP_OAUTH_SERVER_PROVIDER } from './lib/mcp-oauth-server-provider-token';
export { McpMemoryClientsStore } from './lib/mcp-memory-clients-store';
export {
  McpClientIdMetadataDocumentStore,
  McpOAuthClientsStoreLike,
  McpClientIdMetadataDocumentResponse,
  isClientIdMetadataDocumentUrl,
  isPrivateNetworkAddress,
  parseClientIdMetadataDocument,
  fetchClientIdMetadataDocument,
} from './lib/mcp-client-id-metadata-document-store';
export { McpClientIdMetadataDocumentOptions } from './lib/mcp-client-id-metadata-document-options';
