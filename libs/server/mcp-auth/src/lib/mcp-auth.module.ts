import { DynamicModule, Module } from '@nestjs/common';
import type { McpAuthConfig } from './mcp-auth-config';
import type { McpAuthAsyncOptions } from './mcp-auth-async-options';
import { MCP_AUTH_CONFIG } from './mcp-auth-config-token';
import { McpJwksService } from './mcp-jwks.service';
import { McpJwtAuthStrategy } from './mcp-jwt-auth-strategy';
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
 *       authStrategy: McpJwtAuthStrategy,
 *     }),
 *   ],
 * })
 * export class AppModule {}
 * ```
 */
@Module({})
export class McpAuthModule {
  static register(config: McpAuthConfig): DynamicModule {
    const validatedConfig = validateAuthConfig(config);
    const controllers =
      (validatedConfig.serveProtectedResourceMetadata ?? true)
        ? [McpProtectedResourceController]
        : [];

    return {
      module: McpAuthModule,
      controllers,
      providers: [
        { provide: MCP_AUTH_CONFIG, useValue: validatedConfig },
        McpJwksService,
        McpJwtAuthStrategy,
        McpScopeRegistry,
      ],
      exports: [McpJwtAuthStrategy, McpJwksService, McpScopeRegistry, MCP_AUTH_CONFIG],
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
          useFactory: async (...args: unknown[]) => validateAuthConfig(await options.useFactory(...args)),
          inject: options.inject || [],
        },
        McpJwksService,
        McpJwtAuthStrategy,
        McpScopeRegistry,
      ],
      exports: [McpJwtAuthStrategy, McpJwksService, McpScopeRegistry, MCP_AUTH_CONFIG],
    };
  }
}

function validateAuthConfig(config: McpAuthConfig): McpAuthConfig {
  const serveProtectedResourceMetadata = config.serveProtectedResourceMetadata ?? true;
  if (!serveProtectedResourceMetadata) {
    return config;
  }

  if (!config.resourceServerUrl) {
    throw new Error(
      'McpAuthModule requires resourceServerUrl when serveProtectedResourceMetadata is enabled.',
    );
  }

  const hasAuthorizationServers = !!config.authorizationServers?.length;
  if (!hasAuthorizationServers && !config.issuer) {
    throw new Error(
      'McpAuthModule requires authorizationServers or issuer when serveProtectedResourceMetadata is enabled.',
    );
  }

  return config;
}
