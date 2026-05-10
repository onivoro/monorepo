import { All, Controller, DynamicModule, Inject, Logger, Module, Req, Res } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import type { OAuthServerProvider } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { McpOAuthConfig } from './mcp-oauth-config';
import { McpOAuthAsyncOptions } from './mcp-oauth-async-options';
import { MCP_OAUTH_CONFIG } from './mcp-oauth-config-token';
import { MCP_OAUTH_SERVER_PROVIDER } from './mcp-oauth-server-provider-token';
import { McpMemoryClientsStore } from './mcp-memory-clients-store';
import type { Request, Response } from 'express';

const MCP_OAUTH_ROUTER = Symbol('MCP_OAUTH_ROUTER');

function createOAuthController() {
  @Controller()
  class DynamicOAuthController {
    constructor(@Inject(MCP_OAUTH_ROUTER) private readonly router: any) {}

    @All('authorize')
    @All('token')
    @All('register')
    @All('revoke')
    async handleOAuth(@Req() req: Request, @Res() res: Response) {
      await dispatchOAuthRouter(this.router, req, res);
    }
  }

  return DynamicOAuthController;
}

function createWellKnownOAuthController() {
  @Controller('.well-known')
  class DynamicWellKnownOAuthController {
    constructor(@Inject(MCP_OAUTH_ROUTER) private readonly router: any) {}

    @All('oauth-authorization-server')
    async handleWellKnownOAuth(@Req() req: Request, @Res() res: Response) {
      await dispatchOAuthRouter(this.router, req, res);
    }
  }

  return DynamicWellKnownOAuthController;
}

function createProtectedResourceController() {
  @Controller('.well-known/oauth-protected-resource')
  class DynamicProtectedResourceController {
    constructor(@Inject(MCP_OAUTH_ROUTER) private readonly router: any) {}

    @All()
    async handleProtectedResource(@Req() req: Request, @Res() res: Response) {
      await dispatchOAuthRouter(this.router, req, res);
    }

    @All(':resourcePath(*)')
    async handlePathProtectedResource(@Req() req: Request, @Res() res: Response) {
      await dispatchOAuthRouter(this.router, req, res);
    }
  }

  return DynamicProtectedResourceController;
}

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
 *     McpOAuthModule.configure({
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
 * McpOAuthModule.configure({
 *   provider: new ProxyOAuthServerProvider({ ... }),
 *   issuerUrl: 'https://auth.example.com',
 * })
 * ```
 *
 * **Platform requirement:** Requires Express (same as `McpHttpModule`).
 * The SDK's auth router is Express middleware.
 */
@Module({})
export class McpOAuthModule {
  private readonly logger = new Logger(McpOAuthModule.name);

  constructor(
    @Inject(MCP_OAUTH_CONFIG) private readonly config: McpOAuthConfig,
    @Inject(MCP_OAUTH_SERVER_PROVIDER) private readonly provider: OAuthServerProvider,
    private readonly memoryClientsStore: McpMemoryClientsStore,
  ) {}

  static configure(config: McpOAuthConfig): DynamicModule {
    const validatedConfig = validateOAuthConfig(config);
    const providerIsClass = typeof config.provider === 'function';

    return {
      module: McpOAuthModule,
      controllers: [
        createOAuthController(),
        createWellKnownOAuthController(),
        createProtectedResourceController(),
      ],
      providers: [
        { provide: MCP_OAUTH_CONFIG, useValue: validatedConfig },
        McpMemoryClientsStore,
        {
          provide: MCP_OAUTH_ROUTER,
          useFactory: (cfg: McpOAuthConfig, oauthProvider: OAuthServerProvider) =>
            createOAuthRouter(cfg, oauthProvider),
          inject: [MCP_OAUTH_CONFIG, MCP_OAUTH_SERVER_PROVIDER],
        },
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

  static configureAsync(options: McpOAuthAsyncOptions): DynamicModule {
    return {
      module: McpOAuthModule,
      imports: [...(options.imports || [])],
      controllers: [
        createOAuthController(),
        createWellKnownOAuthController(),
        createProtectedResourceController(),
      ],
      providers: [
        {
          provide: MCP_OAUTH_CONFIG,
          useFactory: async (...args: unknown[]) => validateOAuthConfig(await options.useFactory(...args)),
          inject: options.inject || [],
        },
        {
          provide: MCP_OAUTH_SERVER_PROVIDER,
          useFactory: (config: McpOAuthConfig, moduleRef: ModuleRef) => {
            if (typeof config.provider === 'function') {
              return moduleRef.get(config.provider, { strict: false });
            }
            return config.provider;
          },
          inject: [MCP_OAUTH_CONFIG, ModuleRef],
        },
        {
          provide: MCP_OAUTH_ROUTER,
          useFactory: (cfg: McpOAuthConfig, oauthProvider: OAuthServerProvider) =>
            createOAuthRouter(cfg, oauthProvider),
          inject: [MCP_OAUTH_CONFIG, MCP_OAUTH_SERVER_PROVIDER],
        },
        McpMemoryClientsStore,
      ],
      exports: [MCP_OAUTH_CONFIG, MCP_OAUTH_SERVER_PROVIDER, McpMemoryClientsStore],
    };
  }

  onModuleInit(): void {
    this.logInMemoryStoreUsage();
  }

  private logInMemoryStoreUsage() {
    if (process.env.NODE_ENV === 'test') return;
    if (!this.provider || (this.provider as any).clientsStore !== this.memoryClientsStore) return;

    this.logger.warn(
      'McpMemoryClientsStore is active. Registered OAuth clients are stored in memory and will be lost on process restart. Use a persistent OAuthRegisteredClientsStore in production.',
    );
  }

  /** @deprecated Use `configure()` instead. */
  static register(config: McpOAuthConfig): DynamicModule {
    return this.configure(config);
  }

  /** @deprecated Use `configureAsync()` instead. */
  static registerAsync(options: McpOAuthAsyncOptions): DynamicModule {
    return this.configureAsync(options);
  }
}

function validateOAuthConfig(config: McpOAuthConfig): McpOAuthConfig {
  parseAbsoluteUrl(config.issuerUrl, 'issuerUrl');
  if (config.baseUrl) parseAbsoluteUrl(config.baseUrl, 'baseUrl');
  if (config.resourceServerUrl) parseAbsoluteUrl(config.resourceServerUrl, 'resourceServerUrl');
  if (config.serviceDocumentationUrl) parseAbsoluteUrl(config.serviceDocumentationUrl, 'serviceDocumentationUrl');

  return config;
}

function createOAuthRouter(config: McpOAuthConfig, provider: OAuthServerProvider) {
  return mcpAuthRouter({
    provider,
    issuerUrl: new URL(config.issuerUrl),
    ...(config.baseUrl && { baseUrl: new URL(config.baseUrl) }),
    ...(config.scopesSupported && { scopesSupported: config.scopesSupported }),
    ...(config.resourceName && { resourceName: config.resourceName }),
    ...(config.resourceServerUrl && { resourceServerUrl: new URL(config.resourceServerUrl) }),
    ...(config.serviceDocumentationUrl && { serviceDocumentationUrl: new URL(config.serviceDocumentationUrl) }),
    ...(config.authorizationOptions && { authorizationOptions: config.authorizationOptions as any }),
    ...(config.tokenOptions && { tokenOptions: config.tokenOptions as any }),
    ...(config.clientRegistrationOptions && { clientRegistrationOptions: config.clientRegistrationOptions as any }),
    ...(config.revocationOptions && { revocationOptions: config.revocationOptions as any }),
  });
}

async function dispatchOAuthRouter(router: any, req: Request, res: Response) {
  const originalUrl = req.url;
  req.url = req.originalUrl || req.url;

  await new Promise<void>((resolve) => {
    router(req, res, () => resolve());
  });

  req.url = originalUrl;

  if (!res.headersSent) {
    res.status(404).end();
  }
}

function parseAbsoluteUrl(value: string, field: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`McpOAuthModule ${field} must be a valid absolute URL, got "${value}".`);
  }

  if (!parsed.protocol || !parsed.host) {
    throw new Error(`McpOAuthModule ${field} must be a valid absolute URL, got "${value}".`);
  }

  return parsed;
}
