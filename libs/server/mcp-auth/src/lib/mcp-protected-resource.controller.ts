import { Controller, Get, Inject, NotFoundException, Param } from '@nestjs/common';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import type { McpAuthConfig } from './mcp-auth-config';
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
  getRootProtectedResourceMetadata(): Record<string, unknown> {
    this.assertMetadataRouteEnabled('root');
    return this.buildProtectedResourceMetadata();
  }

  @Get('oauth-protected-resource/*resourcePath')
  getPathProtectedResourceMetadata(@Param('resourcePath') resourcePath: string): Record<string, unknown> {
    this.assertMetadataRouteEnabled('path');
    this.assertResourcePathMatch(resourcePath);
    return this.buildProtectedResourceMetadata();
  }

  private buildProtectedResourceMetadata(): Record<string, unknown> {
    if (this.config.serveProtectedResourceMetadata === false) {
      throw new NotFoundException();
    }

    const metadata: Record<string, unknown> = {
      resource: this.config.resourceServerUrl,
      bearer_methods_supported: ['header'],
    };

    const authorizationServers =
      this.config.authorizationServers?.length
        ? this.config.authorizationServers
        : (this.config.issuer ? [this.config.issuer] : undefined);

    if (authorizationServers?.length) {
      metadata['authorization_servers'] = authorizationServers;
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

  private assertMetadataRouteEnabled(route: 'root' | 'path') {
    if (this.config.serveProtectedResourceMetadata === false) {
      throw new NotFoundException();
    }

    const mode = this.config.protectedResourceMetadataMode ?? 'both';
    if (mode !== 'both' && mode !== route) {
      throw new NotFoundException();
    }
  }

  private assertResourcePathMatch(resourcePath: string) {
    const expectedPath = this.getConfiguredResourcePath();
    if (resourcePath !== expectedPath) {
      throw new NotFoundException();
    }
  }

  private getConfiguredResourcePath(): string {
    const resourceUrl = this.config.resourceServerUrl;
    if (!resourceUrl) {
      throw new NotFoundException();
    }

    return new URL(resourceUrl).pathname.replace(/^\/+/, '');
  }
}
