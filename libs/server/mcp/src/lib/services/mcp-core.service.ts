import { Injectable, Logger, Inject, OnModuleInit } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import { apiKeyHeader } from '@onivoro/isomorphic/common';
import * as http from 'http';
import { McpServerConfig, McpToolInfo } from '../interfaces/mcp-config.interface';
import { MCP_CONFIG_TOKEN } from '../providers/mcp-config.provider';

@Injectable()
export class McpCoreService implements OnModuleInit {
  private readonly logger = new Logger(McpCoreService.name);
  private mcpServer: McpServer;
  private transport: StreamableHTTPServerTransport;
  private registeredTools: McpToolInfo[] = [];

  constructor(
    @Inject(MCP_CONFIG_TOKEN) private readonly serverConfig: McpServerConfig
  ) {
    this.initializeMcpServer();
  }

  async onModuleInit() {
    this.logger.log('McpCoreService.onModuleInit() called');
    // Transport connection will be done manually in main.ts
  }

  private initializeMcpServer() {
    this.logger.log('Initializing MCP Server...');

    // Create MCP Server
    this.mcpServer = new McpServer(
      {
        name: this.serverConfig.name,
        version: this.serverConfig.version,
        description: this.serverConfig.description || 'MCP Server',
        author: this.serverConfig.author,
        homepage: this.serverConfig.homepage,
        authentication: this.serverConfig.authentication,
        requiredHeaders: this.serverConfig.requiredHeaders || apiKeyHeader,
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Create transport
    this.transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });

    this.logger.log(`MCP Server '${this.serverConfig.name}' initialized`);
  }

  async connectTransport() {
    if (!this.mcpServer) {
      throw new Error('MCP Server must be initialized before connecting transport');
    }
    if (!this.transport) {
      throw new Error('Transport must be initialized before connecting');
    }

    await this.mcpServer.connect(this.transport);
    this.logger.log('MCP Transport connected');
  }

  registerTool(
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (params: any) => Promise<any>
  ) {
    if (!this.mcpServer) {
      this.logger.error('MCP Server not initialized when trying to register tool:', name);
      return;
    }

    this.mcpServer.tool(name, description, schema, handler);

    // Track registered tools for info endpoint
    const parameters: Record<string, string> = {};
    Object.entries(schema).forEach(([key, zodSchema]) => {
      const isOptional = zodSchema instanceof z.ZodOptional;
      const baseSchema = isOptional ? zodSchema._def.innerType : zodSchema;
      const description = (baseSchema as any)._def?.description || '';
      const type = baseSchema instanceof z.ZodString ? 'string' :
                   baseSchema instanceof z.ZodNumber ? 'number' :
                   'unknown';

      parameters[key] = `${type}${isOptional ? ' (optional)' : ' (required)'} - ${description}`;
    });

    this.registeredTools.push({
      name,
      description,
      parameters
    });

    this.logger.log(`Tool registered: ${name}`);
  }

  async handleMcpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (!this.transport) {
      throw new Error('Transport not initialized');
    }

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, x-api-key');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      // Set default headers if needed
      if (!req.headers.accept) {
        req.headers.accept = req.method === 'GET'
          ? 'text/event-stream'
          : 'application/json, text/event-stream';
      }

      // Let transport handle everything with raw Node.js request/response
      await this.transport.handleRequest(req, res);
    } catch (error) {
      this.logger.error('MCP request handling error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' }
        }));
      }
    }
  }

  getServerInfo() {

    return {
      name: this.serverConfig.name,
      version: this.serverConfig.version,
      description: this.serverConfig.description,
      author: this.serverConfig.author,
      homepage: this.serverConfig.homepage,
      transport: 'HTTP',
      authentication: this.serverConfig.authentication,
      requiredHeaders: [{
        name: this.serverConfig.requiredHeaders || apiKeyHeader,
        description: `Required header: ${this.serverConfig.requiredHeaders || apiKeyHeader}`,
        example: `${this.serverConfig.requiredHeaders || apiKeyHeader}: your-value-here`
      }],
      tools: this.registeredTools,
      architecture: 'NestJS with @Tool decorators'
    };
  }

  getRegisteredTools(): McpToolInfo[] {
    return [...this.registeredTools];
  }
}