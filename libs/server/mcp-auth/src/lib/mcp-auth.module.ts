import { DynamicModule, Module } from '@nestjs/common';
import type { McpAuthConfig } from './mcp-auth-config';
import type { McpAuthAsyncOptions } from './mcp-auth-async-options';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import { McpJwksService } from './mcp-jwks.service';
import { McpJwtAuthProvider } from './mcp-jwt-auth-provider';
import { McpScopeRegistry } from './mcp-scope-registry';
import { McpProtectedResourceController } from './mcp-protected-resource.controller';

/**
 * Resource server auth module for MCP servers.
 *
 * Provides JWT token validation, JWKS key fetching, scope auto-discovery,
 * and RFC 9728 Protected Resource Metadata.
 *
 * **Usage:**
 * ```typescript
 * @Module({
 *   imports: [
 *     McpAuthModule.register({
 *       jwksUri: 'https://auth.example.com/.well-known/jwks.json',
 *       issuer: 'https://auth.example.com',
 *       audience: 'https://mcp.example.com',
 *       resourceServerUrl: 'https://mcp.example.com',
 *       authorizationServers: ['https://auth.example.com'],
 *     }),
 *     McpHttpModule.registerAndServeHttp({
 *       metadata: { name: 'my-server', version: '1.0.0' },
 *       authProvider: McpJwtAuthProvider,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class McpAuthModule {
  static register(config: McpAuthConfig): DynamicModule {
    const controllers =
      (config.serveProtectedResourceMetadata ?? true)
        ? [McpProtectedResourceController]
        : [];

    return {
      module: McpAuthModule,
      controllers,
      providers: [
        { provide: MCP_AUTH_CONFIG, useValue: config },
        McpJwksService,
        McpJwtAuthProvider,
        McpScopeRegistry,
      ],
      exports: [McpJwtAuthProvider, McpJwksService, McpScopeRegistry, MCP_AUTH_CONFIG],
    };
  }

  static registerAsync(options: McpAuthAsyncOptions): DynamicModule {
    return {
      module: McpAuthModule,
      imports: [...(options.imports || [])],
      controllers: [McpProtectedResourceController],
      providers: [
        {
          provide: MCP_AUTH_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        McpJwksService,
        McpJwtAuthProvider,
        McpScopeRegistry,
      ],
      exports: [McpJwtAuthProvider, McpJwksService, McpScopeRegistry, MCP_AUTH_CONFIG],
    };
  }
}
