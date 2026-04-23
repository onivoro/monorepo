import { DynamicModule, Inject, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, ModuleRef } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { McpStdioConfig } from './mcp-stdio-config';
import type { McpStdioAsyncOptions } from './mcp-stdio-async-options';
import { MCP_STDIO_CONFIG } from './mcp-stdio-config-token';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-scope-guard';
import { discoverAndRegisterMcpEntities } from './mcp-discovery';
import { buildCapabilities } from './build-capabilities';
import { wireRegistryToServer } from './wire-registry-to-server';

@Module({})
export class McpStdioModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpStdioModule.name);
  private server?: McpServer;
  private transport?: StdioServerTransport;
  private unsubscribeRegistry?: () => void;

  constructor(
    @Inject(MCP_STDIO_CONFIG) private readonly config: McpStdioConfig,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly registry: McpToolRegistry,
    private readonly moduleRef: ModuleRef,
  ) {}

  static registerAndServeStdio(config: McpStdioConfig): DynamicModule {
    return {
      module: McpStdioModule,
      imports: [DiscoveryModule],
      providers: [
        McpToolRegistry,
        McpScopeGuard,
        { provide: MCP_STDIO_CONFIG, useValue: config },
        ...(config.authStrategy ? [config.authStrategy] : []),
      ],
      exports: [McpToolRegistry],
    };
  }

  static registerAndServeStdioAsync(options: McpStdioAsyncOptions): DynamicModule {
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
    if (this.config.authStrategy) {
      const provider = this.moduleRef.get(this.config.authStrategy, { strict: false });
      this.registry.setAuthStrategy(provider);
    }

    this.server = new McpServer(
      {
        name: this.config.metadata.name,
        version: this.config.metadata.version,
        ...(this.config.metadata.description && { description: this.config.metadata.description }),
      },
      {
        ...this.config.serverOptions,
        capabilities: buildCapabilities(this.registry),
        ...(this.config.metadata.instructions && { instructions: this.config.metadata.instructions }),
      },
    );

    this.unsubscribeRegistry = wireRegistryToServer(this.registry, this.server);

    this.transport = new StdioServerTransport(
      this.config.stdin,
      this.config.stdout,
    );

    await this.server.connect(this.transport);
    this.logger.log(`MCP stdio server started: ${this.config.metadata.name}`);
  }

  async onModuleDestroy() {
    this.unsubscribeRegistry?.();
    try {
      if (this.transport) await this.transport.close();
    } catch (error) {
      this.logger.error('Error closing stdio transport:', error);
    }
    try {
      if (this.server) await this.server.close();
    } catch (error) {
      this.logger.error('Error closing MCP server:', error);
    }
    this.logger.log('MCP stdio server closed');
  }
}
