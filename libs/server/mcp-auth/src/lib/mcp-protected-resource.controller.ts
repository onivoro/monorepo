import { Controller, Get, Inject } from '@nestjs/common';
import { MCP_AUTH_CONFIG } from './mcp-auth.constants';
import type { McpAuthConfig } from './mcp-auth.config';
import { McpScopeRegistry } from './mcp-scope-registry';

/**
 * Serves the RFC 9728 OAuth 2.0 Protected Resource Metadata endpoint
 * at `/.well-known/oauth-protected-resource`.
 *
 * MCP clients use this to discover authorization requirements before
 * starting the OAuth flow.
 */
@Controller('.well-known')
export class McpProtectedResourceController {
  constructor(
    @Inject(MCP_AUTH_CONFIG) private readonly config: McpAuthConfig,
    private readonly scopeRegistry: McpScopeRegistry,
  ) {}

  @Get('oauth-protected-resource')
  getProtectedResourceMetadata(): Record<string, unknown> {
    if (this.config.serveProtectedResourceMetadata === false) {
      return {};
    }

    const metadata: Record<string, unknown> = {
      resource: this.config.resourceServerUrl,
      bearer_methods_supported: ['header'],
    };

    if (this.config.authorizationServers?.length) {
      metadata['authorization_servers'] = this.config.authorizationServers;
    }

    const scopes = this.scopeRegistry.getScopesArray();
    if (scopes.length > 0) {
      metadata['scopes_supported'] = scopes;
    }

    if (this.config.resourceName) {
      metadata['resource_name'] = this.config.resourceName;
    }

    if (this.config.resourceDocumentationUrl) {
      metadata['resource_documentation'] = this.config.resourceDocumentationUrl;
    }

    return metadata;
  }
}
