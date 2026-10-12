import {
  DynamicModule,
  Inject,
  Logger,
  Module,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, ModuleRef } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { McpServer } from '@modelcontextprotocol/server';
import type { McpRequestContext } from '@modelcontextprotocol/server';
import {
  serveStdio,
  StdioServerTransport,
} from '@modelcontextprotocol/server/stdio';
import type { StdioServerHandle } from '@modelcontextprotocol/server/stdio';

type StdioFactory = Parameters<typeof serveStdio>[0];
import type { McpStdioConfig } from './mcp-stdio-config';
import type { McpStdioAsyncOptions } from './mcp-stdio-async-options';
import { MCP_STDIO_CONFIG } from './mcp-stdio-config-token';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-scope-guard';
import { discoverAndRegisterMcpEntities } from './mcp-discovery';
import { applyExposeErrorMessages } from './apply-expose-error-messages';
import { buildCapabilities } from './build-capabilities';
import { wireRegistryToServer } from './wire-registry-to-server';
import { McpStderrLogger } from './mcp-stderr-logger';

/**
 * Sends Nest's logs to stderr, since stdout carries the protocol. Done when the module is
 * declared, before Nest bootstraps, so its startup logs go there too. A `logger` passed to
 * `NestFactory` replaces this.
 */
function redirectLogsToStderr(): void {
  Logger.overrideLogger(new McpStderrLogger());
}

@Module({})
export class McpStdioModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpStdioModule.name);
  private handle?: StdioServerHandle;
  private readonly unsubscribers = new Set<() => void>();

  constructor(
    @Inject(MCP_STDIO_CONFIG) private readonly config: McpStdioConfig,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly registry: McpToolRegistry,
    private readonly moduleRef: ModuleRef,
  ) {}

  static registerAndServeStdio(config: McpStdioConfig): DynamicModule {
    const servesProcessStdout =
      !config.stdout || config.stdout === process.stdout;
    if (config.redirectLogsToStderr ?? servesProcessStdout) {
      redirectLogsToStderr();
    }

    return {
      module: McpStdioModule,
      imports: [DiscoveryModule],
      providers: [
        McpToolRegistry,
        McpScopeGuard,
        { provide: MCP_STDIO_CONFIG, useValue: config },
      ],
      exports: [McpToolRegistry],
    };
  }

  static registerAndServeStdioAsync(
    options: McpStdioAsyncOptions,
  ): DynamicModule {
    if (options.redirectLogsToStderr !== false) {
      redirectLogsToStderr();
    }

    return {
      module: McpStdioModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      providers: [
        McpToolRegistry,
        McpScopeGuard,
        {
          provide: MCP_STDIO_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [McpToolRegistry],
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
    applyExposeErrorMessages(
      this.registry,
      this.config.exposeErrorMessages,
      this.logger,
    );
    if (this.config.authStrategy) {
      const provider = this.moduleRef.get(this.config.authStrategy, {
        strict: false,
      });
      this.registry.setAuthStrategy(provider);
    }

    // The server is only built when the client's first message arrives. Until then there is
    // nothing to toggle, but `setToolEnabled` must still work: the registry remembers the
    // state, and the server starts with it.
    this.unsubscribers.add(this.registry.setToolEnabledDelegate(() => {}));

    // One connection; the client's first message decides which era it speaks. The SDK may
    // also build a throwaway server to answer a `server/discover` probe.
    this.handle = serveStdio(
      // The `/stdio` subpath and the package root can resolve to different copies of the
      // SDK's declarations (ESM and CommonJS), whose `McpServer` types don't match. At
      // runtime both are the same class.
      (ctx) => this.createServer(ctx) as unknown as ReturnType<StdioFactory>,
      {
        transport: new StdioServerTransport(
          this.config.stdin,
          this.config.stdout,
        ),
        onerror: (error) => this.logger.error('MCP stdio error:', error),
      },
    );
    this.logger.log(`MCP stdio server started: ${this.config.metadata.name}`);
  }

  private createServer(ctx: Pick<McpRequestContext, 'era'>): McpServer {
    const server = new McpServer(
      {
        name: this.config.metadata.name,
        version: this.config.metadata.version,
        ...(this.config.metadata.description && {
          description: this.config.metadata.description,
        }),
      },
      {
        ...this.config.serverOptions,
        capabilities: buildCapabilities(this.registry),
        ...(this.config.metadata.instructions && {
          instructions: this.config.metadata.instructions,
        }),
      },
    );

    // The connection is long-lived on both eras, so the server follows the registry; on
    // 2026-07-28 the SDK routes its list-changed and resource-updated notifications to the
    // client's `subscriptions/listen` streams.
    const unsubscribe = wireRegistryToServer(this.registry, server, {
      era: ctx.era,
    });
    this.unsubscribers.add(unsubscribe);
    const previousOnClose = server.server.onclose;
    server.server.onclose = () => {
      unsubscribe();
      this.unsubscribers.delete(unsubscribe);
      previousOnClose?.();
    };
    return server;
  }

  async onModuleDestroy() {
    for (const unsubscribe of this.unsubscribers) unsubscribe();
    this.unsubscribers.clear();
    try {
      await this.handle?.close();
    } catch (error) {
      this.logger.error('Error closing MCP stdio server:', error);
    }
    this.logger.log('MCP stdio server closed');
  }
}
