import { DynamicModule, Inject, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { McpOAuthConfig, McpOAuthAsyncOptions } from './mcp-oauth.config';
import { MCP_OAUTH_CONFIG, MCP_OAUTH_SERVER_PROVIDER } from './mcp-oauth.constants';
import { McpMemoryClientsStore } from './mcp-memory-clients-store';

/**
 * Embedded OAuth 2.1 authorization server module for MCP.
 *
 * Wraps the MCP SDK's `mcpAuthRouter` into NestJS, mounting all standard
 * OAuth endpoints (`/authorize`, `/token`, `/register`, `/revoke`,
 * `/.well-known/oauth-authorization-server`).
 *
 * **Usage with class-based provider (DI-resolved):**
 * ```typescript
 * @Module({
 *   imports: [
 *     McpOAuthModule.register({
 *       provider: MyOAuthProvider,
 *       issuerUrl: 'https://auth.example.com',
 *       scopesSupported: ['read', 'write', 'admin'],
 *     }),
 *   ],
 *   providers: [MyOAuthProvider],
 * })
 * export class AppModule {}
 * ```
 *
 * **Usage with instance (e.g. ProxyOAuthServerProvider):**
 * ```typescript
 * McpOAuthModule.register({
 *   provider: new ProxyOAuthServerProvider({ ... }),
 *   issuerUrl: 'https://auth.example.com',
 * })
 * ```
 *
 * **Platform requirement:** Requires Express (same as `McpHttpModule`).
 * The SDK's auth router is Express middleware.
 */
@Module({})
export class McpOAuthModule implements NestModule {
  constructor(
    @Inject(MCP_OAUTH_CONFIG) private readonly config: McpOAuthConfig,
    @Inject(MCP_OAUTH_SERVER_PROVIDER) private readonly provider: OAuthServerProvider,
  ) {}

  static register(config: McpOAuthConfig): DynamicModule {
    const providerIsClass = typeof config.provider === 'function';

    return {
      module: McpOAuthModule,
      providers: [
        { provide: MCP_OAUTH_CONFIG, useValue: config },
        McpMemoryClientsStore,
        ...(providerIsClass
          ? [
              config.provider as any,
              { provide: MCP_OAUTH_SERVER_PROVIDER, useExisting: config.provider as any },
            ]
          : [
              { provide: MCP_OAUTH_SERVER_PROVIDER, useValue: config.provider },
            ]),
      ],
      exports: [MCP_OAUTH_CONFIG, MCP_OAUTH_SERVER_PROVIDER, McpMemoryClientsStore],
    };
  }

  static registerAsync(options: McpOAuthAsyncOptions): DynamicModule {
    return {
      module: McpOAuthModule,
      imports: [...(options.imports || [])],
      providers: [
        {
          provide: MCP_OAUTH_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
        {
          provide: MCP_OAUTH_SERVER_PROVIDER,
          useFactory: (config: McpOAuthConfig) => {
            if (typeof config.provider === 'function') {
              throw new Error(
                'Class-based providers in registerAsync require manual resolution. ' +
                'Either pass an instance as `provider`, or use `register()` with a class reference.',
              );
            }
            return config.provider;
          },
          inject: [MCP_OAUTH_CONFIG],
        },
        McpMemoryClientsStore,
      ],
      exports: [MCP_OAUTH_CONFIG, MCP_OAUTH_SERVER_PROVIDER, McpMemoryClientsStore],
    };
  }

  configure(consumer: MiddlewareConsumer): void {
    const router = mcpAuthRouter({
      provider: this.provider,
      issuerUrl: new URL(this.config.issuerUrl),
      ...(this.config.baseUrl && { baseUrl: new URL(this.config.baseUrl) }),
      ...(this.config.scopesSupported && { scopesSupported: this.config.scopesSupported }),
      ...(this.config.resourceName && { resourceName: this.config.resourceName }),
      ...(this.config.resourceServerUrl && { resourceServerUrl: new URL(this.config.resourceServerUrl) }),
      ...(this.config.serviceDocumentationUrl && { serviceDocumentationUrl: new URL(this.config.serviceDocumentationUrl) }),
      ...(this.config.authorizationOptions && { authorizationOptions: this.config.authorizationOptions as any }),
      ...(this.config.tokenOptions && { tokenOptions: this.config.tokenOptions as any }),
      ...(this.config.clientRegistrationOptions && { clientRegistrationOptions: this.config.clientRegistrationOptions as any }),
      ...(this.config.revocationOptions && { revocationOptions: this.config.revocationOptions as any }),
    });

    consumer.apply(router).forRoutes('*');
  }
}
