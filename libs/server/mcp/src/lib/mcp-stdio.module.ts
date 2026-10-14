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
import type {
  McpRequestContext,
  McpServer,
  Transport,
} from '@modelcontextprotocol/server';
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
import {
  buildMcpServer,
  warnAboutIgnoredCapabilities,
} from './build-mcp-server';
import { chainHandler } from './chain-handler';
import { wireRegistryToServer } from './wire-registry-to-server';
import { McpStderrLogger } from './mcp-stderr-logger';
import { McpStdioService } from './mcp-stdio.service';

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
  private handle?: Pick<StdioServerHandle, 'close'>;
  private readonly unsubscribers = new Set<() => void>();

  constructor(
    @Inject(MCP_STDIO_CONFIG) private readonly config: McpStdioConfig,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly registry: McpToolRegistry,
    private readonly moduleRef: ModuleRef,
    private readonly stdio: McpStdioService,
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
        McpStdioService,
        { provide: MCP_STDIO_CONFIG, useValue: config },
      ],
      exports: [McpToolRegistry, McpStdioService],
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
        McpStdioService,
        {
          provide: MCP_STDIO_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [McpToolRegistry, McpStdioService],
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
    this.registry.setToolVisibility({
      toolVisibility: this.config.toolVisibility,
      toolFilter: this.config.toolFilter,
    });
    if (this.config.authStrategy) {
      const provider = this.moduleRef.get(this.config.authStrategy, {
        strict: false,
      });
      this.registry.setAuthStrategy(provider);
    }
    warnAboutIgnoredCapabilities(this.config, this.logger);

    // The server is only built when the client's first message arrives. Until then there is
    // nothing to toggle, but `setToolEnabled` must still work: the registry remembers the
    // state, and the server starts with it.
    this.unsubscribers.add(this.registry.setToolEnabledDelegate(() => {}));

    // `McpStdioService` watches the wire to learn when the connection settles on an era and
    // when it closes. The `/stdio` subpath and the package root can resolve to different
    // copies of the SDK's declarations (ESM and CommonJS), whose types don't match. At
    // runtime they are the same classes.
    const transport = this.stdio.observe(
      new StdioServerTransport(
        this.config.stdin,
        this.config.stdout,
      ) as unknown as Transport,
    );
    if (this.config.protocolNegotiation === 'legacy') {
      // 2025-era only: one server on the transport, as before `serveStdio`. It answers a
      // `server/discover` probe with an error, so the client falls back to `initialize`.
      const server = await this.createServer({ era: 'legacy' });
      chainHandler(server.server, 'onerror', (error) =>
        this.logger.error('MCP stdio error:', error),
      );
      await server.connect(transport);
      this.handle = { close: () => server.close() };
      this.logger.log(
        `MCP stdio server started (2025-era only): ${this.config.metadata.name}`,
      );
      return;
    }

    // One connection; the client's first message decides which era it speaks. The SDK may
    // also build a throwaway server to answer a `server/discover` probe.
    this.handle = serveStdio(
      // The same declaration mismatch as above, for `McpServer` and `Transport`.
      (ctx) => this.createServer(ctx) as unknown as ReturnType<StdioFactory>,
      {
        transport: transport as unknown as StdioServerTransport,
        onerror: (error) => this.logger.error('MCP stdio error:', error),
      },
    );
    this.logger.log(`MCP stdio server started: ${this.config.metadata.name}`);
  }

  private async createServer(
    ctx: Pick<McpRequestContext, 'era'>,
  ): Promise<McpServer> {
    // Stdio carries no token: the auth strategy decides who the client is, once per server.
    const visibleTools = await this.registry.resolveVisibleTools(undefined);
    const server = buildMcpServer(this.config, this.registry);

    // The connection is long-lived on both eras, so the server follows the registry; on
    // 2026-07-28 the SDK routes its list-changed and resource-updated notifications to the
    // client's `subscriptions/listen` streams.
    const unwire = wireRegistryToServer(this.registry, server, {
      era: ctx.era,
      visibleTools,
    });
    // The hook runs before the module sets its own callbacks, so a hook that replaces one
    // can't drop them. If it throws, nothing refers to the server any more.
    try {
      this.config.onServerCreated?.(server, { era: ctx.era });
    } catch (error) {
      unwire();
      throw error;
    }
    // `McpStdioService` sends application notifications through the latest server.
    const detach = this.stdio.attach(server, ctx.era);
    const unsubscribe = () => {
      unwire();
      detach();
    };
    this.unsubscribers.add(unsubscribe);
    chainHandler(server.server, 'onclose', () => {
      unsubscribe();
      this.unsubscribers.delete(unsubscribe);
    });
    return server;
  }

  async onModuleDestroy() {
    this.stdio.close();
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
