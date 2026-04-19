import { DynamicModule, Inject, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DiscoveryModule, DiscoveryService } from '@nestjs/core';
import { MetadataScanner } from '@nestjs/core/metadata-scanner';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpStdioConfig } from './mcp-stdio-config.interface';
import { MCP_STDIO_CONFIG } from './mcp.constants';
import { McpToolRegistry } from './mcp-tool-registry';
import { discoverAndRegisterMcpEntities } from './mcp-discovery';

@Module({})
export class McpStdioModule implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(McpStdioModule.name);
  private server?: McpServer;
  private transport?: StdioServerTransport;

  constructor(
    @Inject(MCP_STDIO_CONFIG) private readonly config: McpStdioConfig,
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly registry: McpToolRegistry,
  ) {}

  static registerAndServeStdio(config: McpStdioConfig): DynamicModule {
    return {
      module: McpStdioModule,
      imports: [DiscoveryModule],
      providers: [
        McpToolRegistry,
        { provide: MCP_STDIO_CONFIG, useValue: config },
      ],
      exports: [McpToolRegistry],
    };
  }

  /** @deprecated Use McpStdioModule.registerAndServeStdio() instead */
  static configure(config: McpStdioConfig): DynamicModule {
    return {
      module: McpStdioModule,
      imports: [DiscoveryModule],
      providers: [
        McpToolRegistry,
        { provide: MCP_STDIO_CONFIG, useValue: config },
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

    const tools = this.registry.getTools();
    const resources = this.registry.getResources();
    const prompts = this.registry.getPrompts();

    const capabilities: Record<string, unknown> = {};
    if (tools.length > 0) capabilities['tools'] = {};
    if (resources.length > 0) capabilities['resources'] = {};
    if (prompts.length > 0) capabilities['prompts'] = {};

    this.server = new McpServer(
      { name: this.config.metadata.name, version: this.config.metadata.version },
      { ...this.config.serverOptions, capabilities },
    );

    for (const { metadata } of tools) {
      this.server.registerTool(
        metadata.name,
        { description: metadata.description, inputSchema: metadata.schema?.shape },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (params: any) => this.registry.executeToolMcp(metadata.name, params) as any,
      );
    }

    for (const { metadata, handler } of resources) {
      const resourceConfig: Record<string, string | undefined> = {};
      if (metadata.description) resourceConfig['description'] = metadata.description;
      if (metadata.mimeType) resourceConfig['mimeType'] = metadata.mimeType;

      if (metadata.isTemplate) {
        this.server.registerResource(metadata.name, new ResourceTemplate(metadata.uri, { list: undefined }), resourceConfig, handler);
      } else {
        this.server.registerResource(metadata.name, metadata.uri, resourceConfig, handler);
      }
    }

    for (const { metadata, handler } of prompts) {
      this.server.registerPrompt(metadata.name, { description: metadata.description, argsSchema: metadata.argsSchema }, handler);
    }

    this.transport = new StdioServerTransport(
      this.config.stdin,
      this.config.stdout,
    );

    await this.server.connect(this.transport);
    this.logger.log(`MCP stdio server started: ${this.config.metadata.name}`);
  }

  async onModuleDestroy() {
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
