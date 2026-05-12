import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import * as crypto from 'crypto';
import * as http from 'http';
import type { McpModuleConfig } from './mcp-module-config';
import { MCP_MODULE_CONFIG } from './mcp-module-config-token';
import { McpToolRegistry } from './mcp-tool-registry';
import { buildCapabilities } from './build-capabilities';
import { wireRegistryToServer } from './wire-registry-to-server';
import { normalizeMcpHttpRoute, normalizePath } from './mcp-http-route';

interface SessionEntry {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
  unsubscribeRegistry: () => void;
}

@Injectable()
export class McpHttpService implements OnModuleDestroy {
  private readonly logger = new Logger(McpHttpService.name);

  private readonly sessions = new Map<string, SessionEntry>();
  private readonly sessionTtlMs: number;
  private readonly sweepInterval: ReturnType<typeof setInterval>;
  private bearerTokenVerifier?: OAuthTokenVerifier;
  private bearerAuthRequiredScopes: string[] = [];
  private bearerAuthResourceMetadataUrl?: string;

  constructor(
    @Inject(MCP_MODULE_CONFIG) private readonly config: McpModuleConfig,
    private readonly registry: McpToolRegistry,
  ) {
    this.sessionTtlMs = (config.session?.ttlMinutes ?? 30) * 60 * 1000;
    this.sweepInterval = setInterval(() => this.sweepStaleSessions(), 60_000);
  }

  setBearerAuthVerifier(
    verifier: OAuthTokenVerifier,
    options: { requiredScopes?: string[]; resourceMetadataUrl?: string } = {},
  ) {
    this.bearerTokenVerifier = verifier;
    this.bearerAuthRequiredScopes = options.requiredScopes ?? [];
    this.bearerAuthResourceMetadataUrl = options.resourceMetadataUrl;
  }

  private getSessionIdGenerator(): (() => string) | undefined {
    return this.config.session
      ? (this.config.session.idGenerator ?? (() => crypto.randomUUID()))
      : undefined;
  }

  private createSession(): SessionEntry {
    const entry: Partial<SessionEntry> = { lastActivity: Date.now() };

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: this.getSessionIdGenerator(),
      enableJsonResponse: this.config.enableJsonResponse ?? true,
      onsessioninitialized: (sessionId: string) => {
        this.sessions.set(sessionId, entry as SessionEntry);
        this.logger.log(`Session initialized: ${sessionId}`);
      },
      ...(this.config.session?.eventStore && { eventStore: this.config.session.eventStore }),
    });

    const server = new McpServer(
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

    entry.server = server;
    entry.transport = transport;
    entry.unsubscribeRegistry = wireRegistryToServer(this.registry, server);

    server.connect(transport);

    return entry as SessionEntry;
  }

  private isInitializeRequestBody(body: unknown): boolean {
    const messages = Array.isArray(body) ? body : [body];
    return messages.some((message) =>
      !!message &&
      typeof message === 'object' &&
      'method' in message &&
      (message as { method?: unknown }).method === 'initialize',
    );
  }

  private getRequestOrigin(req: http.IncomingMessage): string | undefined {
    const forwardedProto = req.headers['x-forwarded-proto'];
    const proto = Array.isArray(forwardedProto)
      ? forwardedProto[0]
      : forwardedProto ?? ((req.socket as any)?.encrypted ? 'https' : 'http');

    const forwardedHost = req.headers['x-forwarded-host'];
    const host = Array.isArray(forwardedHost)
      ? forwardedHost[0]
      : forwardedHost ?? req.headers.host;

    if (!host) return undefined;
    return `${proto}://${host}`;
  }

  private async authenticateRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<boolean> {
    if (!this.bearerTokenVerifier) return true;

    const resourceMetadataUrl = this.getResourceMetadataUrl(req);

    let nextCalled = false;
    const middleware = requireBearerAuth({
      verifier: this.bearerTokenVerifier,
      requiredScopes: this.bearerAuthRequiredScopes,
      resourceMetadataUrl,
    });

    await middleware(req as any, res as any, () => {
      nextCalled = true;
    });

    return nextCalled;
  }

  private getResourceMetadataUrl(req: http.IncomingMessage): string | undefined {
    const configuredUrl = this.bearerAuthResourceMetadataUrl;
    if (configuredUrl) {
      if (/^https?:\/\//i.test(configuredUrl)) {
        return configuredUrl;
      }

      const origin = this.getRequestOrigin(req);
      return origin ? new URL(configuredUrl, origin).href : undefined;
    }

    const origin = this.getRequestOrigin(req);
    if (!origin) return undefined;

    const requestPath = this.getRequestPath(req);
    const route = normalizeMcpHttpRoute(this.config.route);
    const mountPrefix = this.getMountPrefix(requestPath, route);
    const metadataSegments = [
      ...this.splitPath(mountPrefix),
      '.well-known',
      'oauth-protected-resource',
      ...this.splitPath(requestPath || route),
    ];

    return new URL(
      `/${metadataSegments.join('/')}`,
      origin,
    ).href;
  }

  private getRequestPath(req: http.IncomingMessage): string {
    const rawUrl =
      typeof (req as any).originalUrl === 'string'
        ? (req as any).originalUrl
        : req.url ?? '';

    return normalizePath(rawUrl);
  }

  private getMountPrefix(requestPath: string, route: string): string {
    if (requestPath === route) return '';

    const routeSuffix = `/${route}`;
    if (requestPath.endsWith(routeSuffix)) {
      return requestPath.slice(0, -routeSuffix.length);
    }

    return '';
  }

  private splitPath(path: string): string[] {
    return path ? path.split('/') : [];
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
      if (req.method !== 'OPTIONS') {
        const authenticated = await this.authenticateRequest(req, res);
        if (!authenticated) return;
      }

      if (!req.headers.accept) {
        req.headers.accept =
          req.method === 'GET' ? 'text/event-stream' : 'application/json, text/event-stream';
      }

      const parsedBody = (req as any).body;
      const isInitializeRequest = req.method === 'POST' && this.isInitializeRequestBody(parsedBody);

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
        if (isInitializeRequest) {
          const newSession = this.createSession();
          await newSession.transport.handleRequest(req, res, parsedBody);
          return;
        }

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
    this.registry.removeSessionSubscriptions(sessionId);
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
