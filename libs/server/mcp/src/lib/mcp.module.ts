import { All, Controller, DynamicModule, Logger, Module, OnModuleInit, Req, Res } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService, ModuleRef } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { Request, Response } from 'express';
import { McpModuleConfig, McpModuleAsyncOptions } from './mcp-config.interface';
import { MCP_MODULE_CONFIG } from './mcp.constants';
import { McpService } from './mcp.service';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-guard';
import { discoverAndRegisterMcpEntities } from './mcp-discovery';

function createMcpController(routePrefix?: string) {
  const route = routePrefix ? `${routePrefix}/mcp` : 'mcp';

  @Controller()
  class DynamicMcpController {
    constructor(private readonly mcpService: McpService) {}

    @All(route)
    async handleMcp(@Req() req: Request, @Res() res: Response) {
      await this.mcpService.handleRequest(req as any, res as any);
    }
  }

  return DynamicMcpController;
}

@Module({})
export class McpHttpModule implements OnModuleInit {
  private readonly logger = new Logger(McpHttpModule.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly registry: McpToolRegistry,
    private readonly moduleRef: ModuleRef,
  ) {}

  static registerAndServeHttp(config: McpModuleConfig): DynamicModule {
    return {
      module: McpHttpModule,
      imports: [DiscoveryModule],
      controllers: [createMcpController(config.routePrefix)],
      providers: [McpToolRegistry, McpService, McpScopeGuard, { provide: MCP_MODULE_CONFIG, useValue: config }],
      exports: [McpService, McpToolRegistry],
    };
  }

  static registerAndServeHttpAsync(options: McpModuleAsyncOptions): DynamicModule {
    return {
      module: McpHttpModule,
      imports: [DiscoveryModule, ...(options.imports || [])],
      controllers: [createMcpController()],
      providers: [
        McpToolRegistry,
        McpService,
        McpScopeGuard,
        {
          provide: MCP_MODULE_CONFIG,
          useFactory: options.useFactory,
          inject: options.inject || [],
        },
      ],
      exports: [McpService, McpToolRegistry],
    };
  }

  /** @deprecated Use McpHttpModule.registerAndServeHttp() instead */
  static configure(config: McpModuleConfig): DynamicModule {
    return {
      module: McpHttpModule,
      imports: [DiscoveryModule],
      controllers: [createMcpController(config.routePrefix)],
      providers: [McpToolRegistry, McpService, McpScopeGuard, { provide: MCP_MODULE_CONFIG, useValue: config }],
      exports: [McpService, McpToolRegistry],
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
  }
}
