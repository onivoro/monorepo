import { Module, DynamicModule } from '@nestjs/common';
import { DiscoveryModule, MetadataScanner } from '@nestjs/core';
import { McpController } from './controllers/mcp.controller';
import { McpCoreService } from './services/mcp-core.service';
import { ToolDiscoveryService } from './services/tool-discovery.service';
import { McpServerConfig } from './interfaces/mcp-config.interface';
import { createMcpConfigProvider, defaultMcpConfig } from './providers/mcp-config.provider';

@Module({})
export class ServerMcpModule {
  static configure(config?: Partial<McpServerConfig>): DynamicModule {
    const finalConfig = { ...defaultMcpConfig, ...config };

    return {
      module: ServerMcpModule,
      imports: [DiscoveryModule],
      controllers: [McpController],
      providers: [
        createMcpConfigProvider(finalConfig),
        McpCoreService,
        ToolDiscoveryService,
        MetadataScanner,
      ],
      exports: [McpCoreService, ToolDiscoveryService],
    };
  }

  static forRoot(config?: Partial<McpServerConfig>): DynamicModule {
    return this.configure(config);
  }
}