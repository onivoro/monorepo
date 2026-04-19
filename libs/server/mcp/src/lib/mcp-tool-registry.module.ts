import { DynamicModule, Logger, Module, OnModuleInit } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { McpToolRegistry } from './mcp-tool-registry';
import { discoverAndRegisterMcpEntities } from './mcp-discovery';

@Module({})
export class McpRegistryModule implements OnModuleInit {
  private readonly logger = new Logger(McpRegistryModule.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly registry: McpToolRegistry,
  ) {}

  static registerOnly(): DynamicModule {
    return {
      module: McpRegistryModule,
      imports: [DiscoveryModule],
      providers: [McpToolRegistry],
      exports: [McpToolRegistry],
    };
  }

  /** @deprecated Use McpRegistryModule.registerOnly() instead. Note: McpModule has been renamed to McpHttpModule. */
  static forFeature(): DynamicModule {
    return {
      module: McpRegistryModule,
      imports: [DiscoveryModule],
      providers: [McpToolRegistry],
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
  }
}
