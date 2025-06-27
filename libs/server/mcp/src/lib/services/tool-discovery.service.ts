import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { MCP_TOOL_METADATA, ToolMetadata } from '../decorators/tool.decorator';
import { McpCoreService } from './mcp-core.service';

@Injectable()
export class ToolDiscoveryService implements OnModuleInit {
  private readonly logger = new Logger(ToolDiscoveryService.name);

  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly mcpCoreService: McpCoreService,
  ) {}

  async onModuleInit() {
    try {
      // Tools will be discovered after McpCoreService is initialized
      await this.discoverAndRegisterTools();
    } catch (error) {
      this.logger.error('Failed to discover and register tools:', error);
      throw error;
    }
  }

  private async discoverAndRegisterTools() {
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();

    // Scan both providers and controllers for @Tool decorated methods
    const instances = [...providers, ...controllers]
      .filter(wrapper => wrapper.isDependencyTreeDurable() && wrapper.instance)
      .map(wrapper => ({
        instance: wrapper.instance,
        name: wrapper.name,
      }));

    for (const { instance, name } of instances) {
      const prototype = Object.getPrototypeOf(instance);
      const methodNames = this.metadataScanner.scanFromPrototype(
        instance,
        prototype,
        (methodName: string) => methodName,
      );

      for (const methodName of methodNames) {
        const toolMetadata: ToolMetadata = Reflect.getMetadata(
          MCP_TOOL_METADATA,
          prototype,
          methodName,
        );

        if (toolMetadata) {
          const paramMetadata = Reflect.getMetadata('mcp:params', prototype, methodName) || [];
          
          // Register the tool with MCP server
          await this.registerTool(
            toolMetadata,
            instance,
            methodName,
            paramMetadata,
            name,
          );
        }
      }
    }
  }

  private async registerTool(
    toolMetadata: ToolMetadata,
    instance: any,
    methodName: string,
    paramMetadata: any[],
    serviceName: string,
  ) {
    const { name, description, schema } = toolMetadata;

    this.logger.log(`📝 Registering MCP tool: ${name} from ${serviceName}.${methodName}`);

    // Convert schema to Zod schema object
    const zodSchema = schema || {};

    // Register with MCP server
    this.mcpCoreService.registerTool(
      name,
      description,
      zodSchema,
      async (params: any) => {
        try {
          // Call the actual method with proper parameter mapping
          const result = await instance[methodName](params);
          
          // Ensure result is in MCP format
          if (result && typeof result === 'object' && result.content) {
            return result;
          }
          
          // Auto-wrap simple return values
          return {
            content: [{
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            }]
          };
        } catch (error) {
          this.logger.error(`Error executing tool ${name}:`, error);
          return {
            content: [{
              type: 'text',
              text: `❌ Error executing ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`
            }]
          };
        }
      },
    );
  }
}