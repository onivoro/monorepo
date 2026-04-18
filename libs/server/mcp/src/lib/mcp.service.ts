import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as crypto from 'crypto';
import * as http from 'http';
import { McpModuleConfig } from './mcp-config.interface';
import { MCP_MODULE_CONFIG } from './mcp.constants';
import { McpToolRegistry } from './mcp-tool-registry';

interface SessionEntry {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}

@Injectable()
export class McpService implements OnModuleDestroy {
  private readonly logger = new Logger(McpService.name);

  private readonly sessions = new Map<string, SessionEntry>();
  private readonly sessionTtlMs: number;
  private readonly sweepInterval: ReturnType<typeof setInterval>;

  constructor(
    @Inject(MCP_MODULE_CONFIG) private readonly config: McpModuleConfig,
    private readonly registry: McpToolRegistry,
  ) {
    this.sessionTtlMs = (config.sessionTtlMinutes ?? 30) * 60 * 1000;
    this.sweepInterval = setInterval(() => this.sweepStaleSessions(), 60_000);
  }

  private createSession(): SessionEntry {
    const entry: Partial<SessionEntry> = { lastActivity: Date.now() };

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => crypto.randomUUID(),
      enableJsonResponse: true,
      onsessioninitialized: (sessionId: string) => {
        this.sessions.set(sessionId, entry as SessionEntry);
        this.logger.log(`Session initialized: ${sessionId}`);
      },
    });

    const tools = this.registry.getTools();
    const resources = this.registry.getResources();
    const prompts = this.registry.getPrompts();

    const capabilities: Record<string, unknown> = {};
    if (tools.length > 0) capabilities['tools'] = {};
    if (resources.length > 0) capabilities['resources'] = {};
    if (prompts.length > 0) capabilities['prompts'] = {};

    const server = new McpServer(
      { name: this.config.metadata.name, version: this.config.metadata.version },
      { ...this.config.serverOptions, capabilities },
    );

    entry.server = server;
    entry.transport = transport;

    for (const { metadata } of tools) {
      server.registerTool(
        metadata.name,
        { description: metadata.description, inputSchema: metadata.schema },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (params: any) => this.registry.executeToolMcp(metadata.name, params) as any,
      );
    }

    for (const { metadata, handler } of resources) {
      const resourceConfig: Record<string, string | undefined> = {};
      if (metadata.description) resourceConfig['description'] = metadata.description;
      if (metadata.mimeType) resourceConfig['mimeType'] = metadata.mimeType;

      if (metadata.isTemplate) {
        server.registerResource(metadata.name, new ResourceTemplate(metadata.uri, { list: undefined }), resourceConfig, handler);
      } else {
        server.registerResource(metadata.name, metadata.uri, resourceConfig, handler);
      }
    }

    for (const { metadata, handler } of prompts) {
      server.registerPrompt(metadata.name, { description: metadata.description, argsSchema: metadata.argsSchema }, handler);
    }

    server.connect(transport);

    return entry as SessionEntry;
  }

  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    const sessionId = req.headers['mcp-session-id'] as string | undefined;

    try {
      if (!req.headers.accept) {
        req.headers.accept =
          req.method === 'GET' ? 'text/event-stream' : 'application/json, text/event-stream';
      }

      const parsedBody = (req as any).body;

      if (req.method === 'POST' && !sessionId) {
        const session = this.createSession();
        await session.transport.handleRequest(req, res, parsedBody);
        return;
      }

      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Missing Mcp-Session-Id header' },
          id: null,
        }));
        return;
      }

      const session = this.sessions.get(sessionId);
      if (!session) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32600, message: 'Invalid session ID' },
          id: null,
        }));
        return;
      }

      session.lastActivity = Date.now();

      if (req.method === 'DELETE') {
        try {
          await session.transport.handleRequest(req, res, parsedBody);
        } finally {
          this.sessions.delete(sessionId);
          await this.closeSession(sessionId, session);
        }
        return;
      }

      await session.transport.handleRequest(req, res, parsedBody);
    } catch (error) {
      this.logger.error('MCP request handling error:', error);
      if (!res.headersSent) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal error' },
          id: null,
        }));
      }
    }
  }

  private sweepStaleSessions() {
    const now = Date.now();
    for (const [sessionId, session] of this.sessions) {
      if (now - session.lastActivity > this.sessionTtlMs) {
        this.logger.log(`Evicting idle session: ${sessionId}`);
        this.sessions.delete(sessionId);
        this.closeSession(sessionId, session);
      }
    }
  }

  private async closeSession(sessionId: string, session: SessionEntry) {
    try {
      await session.transport.close();
    } catch (error) {
      this.logger.error(`Error closing transport for session ${sessionId}:`, error);
    }
    try {
      await session.server.close();
    } catch (error) {
      this.logger.error(`Error closing server for session ${sessionId}:`, error);
    }
    this.logger.log(`Session closed: ${sessionId}`);
  }

  async onModuleDestroy() {
    clearInterval(this.sweepInterval);
    for (const [sessionId, session] of this.sessions) {
      await this.closeSession(sessionId, session);
    }
    this.sessions.clear();
    this.logger.log('All MCP sessions closed');
  }
}
