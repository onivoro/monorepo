import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as crypto from 'crypto';
import * as http from 'http';
import { McpModuleConfig } from './mcp-config.interface';
import { MCP_MODULE_CONFIG } from './mcp.constants';
import { McpToolRegistry } from './mcp-tool-registry';
import { buildCapabilities, wireRegistryToServer } from './wire-registry-to-server';

interface SessionEntry {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
  unsubscribeRegistry: () => void;
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

    const server = new McpServer(
      { name: this.config.metadata.name, version: this.config.metadata.version },
      { ...this.config.serverOptions, capabilities: buildCapabilities(this.registry) },
    );

    entry.server = server;
    entry.transport = transport;
    entry.unsubscribeRegistry = wireRegistryToServer(this.registry, server);

    server.connect(transport);

    return entry as SessionEntry;
  }

  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    // -- DNS rebinding protection (MCP spec 2025-03-26+) --
    if (this.config.allowedOrigins) {
      const origin = req.headers['origin'];
      if (origin && !this.config.allowedOrigins.includes(origin)) {
        res.writeHead(403, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: '2.0',
          error: { code: -32600, message: `Origin "${origin}" is not allowed` },
          id: null,
        }));
        return;
      }
    }

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
    session.unsubscribeRegistry();
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
