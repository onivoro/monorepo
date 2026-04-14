import { All, Controller, DynamicModule, Logger, Module, OnModuleInit, Req, Res } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { Request, Response } from 'express';
import { McpModuleConfig } from './mcp-config.interface';
import { MCP_MODULE_CONFIG, MCP_TOOL_METADATA, MCP_RESOURCE_METADATA, MCP_PROMPT_METADATA } from './mcp.constants';
import { McpService } from './mcp.service';
import type { McpToolMetadata, McpResourceMetadata, McpPromptMetadata } from './mcp.decorator';

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
export class McpModule implements OnModuleInit {
  private readonly logger = new Logger(McpModule.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly mcpService: McpService,
  ) {}

  static configure(config: McpModuleConfig): DynamicModule {
    return {
      module: McpModule,
      imports: [DiscoveryModule],
      controllers: [createMcpController(config.routePrefix)],
      providers: [McpService, { provide: MCP_MODULE_CONFIG, useValue: config }],
      exports: [McpService],
    };
  }

  async onModuleInit() {
    const instances = this.getDiscoverableInstances();

    for (const { instance, name } of instances) {
      const prototype = Object.getPrototypeOf(instance);
      const methodNames = this.metadataScanner.scanFromPrototype(
        instance,
        prototype,
        (methodName: string) => methodName,
      );

      for (const methodName of methodNames) {
        const methodRef = prototype[methodName];

        this.discoverTool(methodRef, prototype, methodName, instance, name);
        this.discoverResource(methodRef, prototype, methodName, instance, name);
        this.discoverPrompt(methodRef, prototype, methodName, instance, name);
      }
    }
  }

  private getDiscoverableInstances() {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();

    return [...providers, ...controllers]
      .filter((wrapper) => wrapper.instance && typeof wrapper.instance === 'object')
      .map((wrapper) => ({ instance: wrapper.instance, name: wrapper.name }));
  }

  private discoverTool(
    methodRef: any,
    prototype: any,
    methodName: string,
    instance: any,
    serviceName: string,
  ) {
    const metadata: McpToolMetadata | undefined =
      Reflect.getMetadata(MCP_TOOL_METADATA, methodRef) ||
      Reflect.getMetadata(MCP_TOOL_METADATA, prototype, methodName);

    if (!metadata) return;

    this.logger.log(`Registering MCP tool: ${metadata.name} from ${serviceName}.${methodName}`);

    this.mcpService.registerTool(metadata, async (params: any) => {
      try {
        const result = await instance[methodName](params);

        if (result && typeof result === 'object' && result.content) {
          return result;
        }

        return {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        this.logger.error(`Error executing tool ${metadata.name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${metadata.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private discoverResource(
    methodRef: any,
    prototype: any,
    methodName: string,
    instance: any,
    serviceName: string,
  ) {
    const metadata: McpResourceMetadata | undefined =
      Reflect.getMetadata(MCP_RESOURCE_METADATA, methodRef) ||
      Reflect.getMetadata(MCP_RESOURCE_METADATA, prototype, methodName);

    if (!metadata) return;

    this.logger.log(`Registering MCP resource: ${metadata.name} from ${serviceName}.${methodName}`);

    this.mcpService.registerResource(metadata, async (...args: any[]) => {
      try {
        return await instance[methodName](...args);
      } catch (error) {
        this.logger.error(`Error reading resource ${metadata.name}:`, error);
        return {
          contents: [
            {
              uri: metadata.uri,
              text: `Error reading ${metadata.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    });
  }

  private discoverPrompt(
    methodRef: any,
    prototype: any,
    methodName: string,
    instance: any,
    serviceName: string,
  ) {
    const metadata: McpPromptMetadata | undefined =
      Reflect.getMetadata(MCP_PROMPT_METADATA, methodRef) ||
      Reflect.getMetadata(MCP_PROMPT_METADATA, prototype, methodName);

    if (!metadata) return;

    this.logger.log(`Registering MCP prompt: ${metadata.name} from ${serviceName}.${methodName}`);

    this.mcpService.registerPrompt(metadata, async (...args: any[]) => {
      try {
        return await instance[methodName](...args);
      } catch (error) {
        this.logger.error(`Error executing prompt ${metadata.name}:`, error);
        return {
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Error executing ${metadata.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
              },
            },
          ],
        };
      }
    });
  }
}
