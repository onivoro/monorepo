import { All, Controller, DynamicModule, Inject, Logger, Module, OnModuleInit, Req, Res } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, ModuleRef } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { Request, Response } from 'express';
import type { McpModuleConfig } from './mcp-module-config';
import type { McpModuleAsyncOptions } from './mcp-module-async-options';
import { MCP_MODULE_CONFIG } from './mcp-module-config-token';
import { McpHttpService } from './mcp-http.service';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-scope-guard';
import { discoverAndRegisterMcpEntities } from './mcp-discovery';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';

function createMcpController(routePrefix?: string) {
  const route = routePrefix ? `${routePrefix}/mcp` : 'mcp';

  @Controller()
  class DynamicMcpController {
    constructor(private readonly mcpService: McpHttpService) {}

    @All(route)
    async handleMcp(@Req() req: Request, @Res() res: Response) {
      if (req.method === 'POST' && typeof (req as any).body === 'undefined') {
        res.status(500).json({
          jsonrpc: '2.0',
          error: {
            code: -32603,
            message: 'Request body not parsed. McpHttpModule requires Express platform with body-parsing middleware.',
          },
          id: null,
        });
        return;
      }
      await this.mcpService.handleRequest(req as any, res as any);
    }
  }

  return DynamicMcpController;
}

/**
 * MCP HTTP transport module using Streamable HTTP.
 *
 * **Platform requirement:** This module requires NestJS's Express platform
 * (`@nestjs/platform-express`, the default). It depends on Express body-parsing
 * middleware populating `req.body` on incoming requests.
 *
 * **Fastify is not supported.** The `@nestjs/platform-fastify` adapter uses
 * different request/response types and body-parsing mechanics that are
 * incompatible with this module's controller. If you need Fastify, use
 * `McpRegistryModule.registerOnly()` and implement a custom controller that
 * extracts the body from Fastify's request object and passes raw Node
 * `http.IncomingMessage` / `http.ServerResponse` to `McpHttpService.handleRequest()`.
 */
@Module({})
export class McpHttpModule implements OnModuleInit {
  private readonly logger = new Logger(McpHttpModule.name);

  constructor(
    @Inject(MCP_MODULE_CONFIG) private readonly config: McpModuleConfig,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly registry: McpToolRegistry,
    private readonly moduleRef: ModuleRef,
    private readonly httpService: McpHttpService,
  ) {}

  static registerAndServeHttp(config: McpModuleConfig): DynamicModule {
    return {
      module: McpHttpModule,
      imports: [DiscoveryModule],
      controllers: [createMcpController(config.routePrefix)],
      providers: [
        McpToolRegistry, McpHttpService, McpScopeGuard,
        { provide: MCP_MODULE_CONFIG, useValue: config },
      ],
      exports: [McpHttpService, McpToolRegistry],
    };
  }

  static registerAndServeHttpAsync(options: McpModuleAsyncOptions): DynamicModule {
    return {
      module: McpHttpModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      controllers: [createMcpController()],
      providers: [
        McpToolRegistry,
        McpHttpService,
        McpScopeGuard,
        {
          provide: MCP_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [McpHttpService, McpToolRegistry],
    };
  }

  async onModuleInit() {
    discoverAndRegisterMcpEntities(
      this.discoveryService,
      this.metadataScanner,
      this.registry,
      this.logger,
    );
    this.registry.setGuardResolver((guardClass) =>
      this.moduleRef.get(guardClass, { strict: false }),
    );
    this.registry.setProviderResolver((cls) =>
      this.moduleRef.get(cls, { strict: false }),
    );
    if (this.config.authStrategy) {
      const provider = this.moduleRef.get(this.config.authStrategy, { strict: false });
      if (this.config.requireBearerAuth) {
        if (!this.isOAuthTokenVerifier(provider)) {
          throw new Error(
            `authStrategy ${this.config.authStrategy.name} does not implement OAuthTokenVerifier, ` +
            'so it cannot be used with requireBearerAuth.',
          );
        }

        const requiredScopes =
          typeof this.config.requireBearerAuth === 'object'
            ? (this.config.requireBearerAuth.requiredScopes ?? [])
            : [];
        const resourceMetadataUrl =
          typeof this.config.requireBearerAuth === 'object'
            ? this.config.requireBearerAuth.resourceMetadataUrl
            : undefined;

        this.assertValidResourceMetadataUrl(resourceMetadataUrl);

        this.httpService.setBearerAuthVerifier(provider, { requiredScopes, resourceMetadataUrl });
      }
      this.registry.setAuthStrategy(provider);
    }
  }

  private isOAuthTokenVerifier(provider: unknown): provider is OAuthTokenVerifier {
    return !!provider && typeof (provider as OAuthTokenVerifier).verifyAccessToken === 'function';
  }

  private assertValidResourceMetadataUrl(resourceMetadataUrl?: string) {
    if (!resourceMetadataUrl) return;
    if (resourceMetadataUrl.startsWith('/')) return;

    try {
      new URL(resourceMetadataUrl);
    } catch {
      throw new Error(
        `requireBearerAuth.resourceMetadataUrl must be an absolute URL or a root-relative path, got "${resourceMetadataUrl}".`,
      );
    }
  }
}
