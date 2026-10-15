import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  OAuthError,
  isLegacyRequest,
  McpServer,
  verifyBearerToken,
} from '@modelcontextprotocol/server';
import type {
  AuthInfo,
  McpHttpHandler,
  OAuthTokenVerifier,
} from '@modelcontextprotocol/server';
import {
  NodeStreamableHTTPServerTransport,
  toNodeHandler,
} from '@modelcontextprotocol/node';
import * as crypto from 'crypto';
import * as http from 'http';
import type { McpModuleConfig } from './mcp-module-config';
import { MCP_MODULE_CONFIG } from './mcp-module-config-token';
import { McpToolRegistry } from './mcp-tool-registry';
import {
  buildMcpServer,
  warnAboutIgnoredCapabilities,
} from './build-mcp-server';
import { wireRegistryToServer } from './wire-registry-to-server';
import { normalizeMcpHttpRoute, normalizePath } from './mcp-http-route';

interface SessionEntry {
  server: McpServer;
  transport: NodeStreamableHTTPServerTransport;
  lastActivity: number;
  unsubscribeRegistry: () => void;
  sessionId?: string;
  /** Who opened the session, when the request was authenticated (see `session.principal`). */
  principal?: string;
}

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);
const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * The default session owner: the OAuth client plus, when the token carries one, the
 * subject (`extra.sub`, which `@onivoro/server-mcp-auth` fills from the JWT `sub` claim).
 */
function defaultSessionPrincipal(authInfo: AuthInfo): string {
  return JSON.stringify([authInfo.clientId, authInfo.extra?.['sub'] ?? null]);
}

@Injectable()
export class McpHttpService implements OnModuleDestroy {
  private readonly logger = new Logger(McpHttpService.name);

  private readonly sessions = new Map<string, SessionEntry>();
  private readonly sessionTtlMs: number;
  private readonly sweepInterval: ReturnType<typeof setInterval>;
  private readonly jsonResponse: boolean;
  private bearerTokenVerifier?: OAuthTokenVerifier;
  private bearerAuthRequiredScopes: string[] = [];
  private bearerAuthResourceMetadataUrl?: string;
  private bearerAuthExpectedResource?: URL;
  private warnedAboutLegacyOAuthError = false;
  /** Serves 2026-07-28 clients: stateless, one fresh server per request. */
  private readonly modern: McpHttpHandler;
  private readonly modernNode: (
    req: http.IncomingMessage,
    res: http.ServerResponse,
    parsedBody?: unknown,
  ) => Promise<void>;
  private readonly unsubscribeModern: () => void;

  constructor(
    @Inject(MCP_MODULE_CONFIG) private readonly config: McpModuleConfig,
    private readonly registry: McpToolRegistry,
  ) {
    this.sessionTtlMs = (config.session?.ttlMinutes ?? 30) * 60 * 1000;
    this.jsonResponse = config.enableJsonResponse ?? false;
    this.sweepInterval = setInterval(() => this.sweepStaleSessions(), 60_000);
    // The sweep only matters while the app runs; it must not keep the process alive.
    this.sweepInterval.unref?.();
    warnAboutIgnoredCapabilities(config, this.logger);

    const onerror = (error: unknown) =>
      this.logger.error('MCP request handling error:', error);
    this.modern = createMcpHandler(() => this.createModernServer(), {
      // Legacy clients are classified first and served by the session logic below.
      legacy: 'reject',
      responseMode: this.jsonResponse ? 'json' : 'auto',
      onerror,
    });
    this.modernNode = toNodeHandler(this.modern, { onerror });
    this.unsubscribeModern = this.notifyModernClientsOfChanges();
  }

  /**
   * 2026-07-28 clients learn about changes on their `subscriptions/listen` streams, which
   * the handler serves. Per-request servers can't publish to them, so registry changes are
   * published through the handler instead.
   */
  private notifyModernClientsOfChanges(): () => void {
    const notify = this.modern.notify;
    const unsubscribers = [
      this.registry.onRegistrationChange((type) => {
        if (type === 'tool') notify.toolsChanged();
        else if (type === 'resource') notify.resourcesChanged();
        else notify.promptsChanged();
      }),
      this.registry.setToolEnabledDelegate(() => notify.toolsChanged()),
      this.registry.onResourceUpdate((uri) => notify.resourceUpdated(uri)),
    ];
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }

  private createMcpServer(
    requestScopedMessages: boolean,
    notifications: boolean,
  ) {
    return buildMcpServer(this.config, this.registry, {
      logging: requestScopedMessages,
      notifications,
    });
  }

  /**
   * A server for one 2026-07-28 request. It needs no registry subscriptions: it sees the
   * registry as it is now, and change notifications go through the handler.
   */
  private createModernServer(): McpServer {
    // With SSE responses (the default), progress and logs ride the request's stream.
    const requestScopedMessages = !this.jsonResponse;
    const server = this.createMcpServer(requestScopedMessages, true);
    wireRegistryToServer(this.registry, server, {
      requestScopedMessages,
      unsolicitedMessages: true,
      era: 'modern',
      followRegistry: false,
    });
    return server;
  }

  setBearerAuthVerifier(
    verifier: OAuthTokenVerifier,
    options: {
      requiredScopes?: string[];
      resourceMetadataUrl?: string;
      expectedResource?: URL;
    } = {},
  ) {
    this.bearerTokenVerifier = verifier;
    this.bearerAuthRequiredScopes = options.requiredScopes ?? [];
    this.bearerAuthResourceMetadataUrl = options.resourceMetadataUrl;
    this.bearerAuthExpectedResource = options.expectedResource;
  }

  private get stateful(): boolean {
    return !!this.config.session;
  }

  private getSessionIdGenerator(): (() => string) | undefined {
    return this.config.session
      ? (this.config.session.idGenerator ?? (() => crypto.randomUUID()))
      : undefined;
  }

  private getPrincipal(req: http.IncomingMessage): string | undefined {
    const authInfo = (req as { auth?: AuthInfo }).auth;
    if (!authInfo) return undefined;
    return (this.config.session?.principal ?? defaultSessionPrincipal)(
      authInfo,
    );
  }

  /** A 2025-era connection: a stored session when stateful, else one request's worth. */
  private createLegacySession(principal?: string): SessionEntry {
    const entry: Partial<SessionEntry> = {
      lastActivity: Date.now(),
      principal,
    };

    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: this.getSessionIdGenerator(),
      enableJsonResponse: this.jsonResponse,
      onsessioninitialized: (sessionId: string) => {
        entry.sessionId = sessionId;
        this.sessions.set(sessionId, entry as SessionEntry);
        this.logger.log(`Session initialized: ${sessionId}`);
      },
      ...(this.config.session?.eventStore && {
        eventStore: this.config.session.eventStore,
      }),
    });

    // JSON responses can't carry progress, logs or server-to-client requests, and only a
    // stateful session has a stream for notifications that aren't tied to a request.
    const requestScopedMessages = !this.jsonResponse;
    const unsolicitedMessages = this.stateful;
    const server = this.createMcpServer(
      requestScopedMessages,
      unsolicitedMessages,
    );

    entry.server = server;
    entry.transport = transport;
    entry.unsubscribeRegistry = wireRegistryToServer(this.registry, server, {
      requestScopedMessages,
      unsolicitedMessages,
      era: 'legacy',
    });

    server.connect(transport);

    return entry as SessionEntry;
  }

  private isInitializeRequestBody(body: unknown): boolean {
    const messages = Array.isArray(body) ? body : [body];
    return messages.some(
      (message) =>
        !!message &&
        typeof message === 'object' &&
        'method' in message &&
        (message as { method?: unknown }).method === 'initialize',
    );
  }

  private firstHeader(
    value: string | string[] | undefined,
  ): string | undefined {
    const first = Array.isArray(value) ? value[0] : value;
    // Proxies may append to a forwarded header; the first entry is the client-facing one.
    return first?.split(',')[0]?.trim() || undefined;
  }

  private getRequestHost(req: http.IncomingMessage): string | undefined {
    return (
      this.firstHeader(req.headers['x-forwarded-host']) ??
      this.firstHeader(req.headers.host)
    );
  }

  private getRequestOrigin(req: http.IncomingMessage): string | undefined {
    const proto =
      this.firstHeader(req.headers['x-forwarded-proto']) ??
      ((req.socket as any)?.encrypted ? 'https' : 'http');

    const host = this.getRequestHost(req);
    if (!host) return undefined;
    return `${proto}://${host}`;
  }

  /**
   * DNS rebinding protection: the spec requires validating `Origin`. With `allowedOrigins`
   * set, the origin must be listed (`'*'` allows any). Without it, a browser request is only
   * accepted from the server's own origin. Requests without `Origin` (non-browser clients)
   * pass.
   */
  private isOriginAllowed(req: http.IncomingMessage): boolean {
    const origin = req.headers['origin'];
    if (!origin) return true;

    const allowedOrigins = this.config.allowedOrigins;
    if (allowedOrigins) {
      return allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    }

    const host = this.getRequestHost(req);
    try {
      return !!host && new URL(origin).host === host.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * With `allowedHosts` set, the `Host` header must be listed. Without it, a server reached
   * on a loopback address only answers to loopback host names: a DNS-rebound page reaches
   * it under the attacker's host name (and same-origin `Origin`), which this rejects.
   */
  private isHostAllowed(req: http.IncomingMessage): boolean {
    const host = req.headers.host?.toLowerCase();
    const allowedHosts = this.config.allowedHosts;
    if (allowedHosts) {
      return (
        !!host && allowedHosts.some((allowed) => allowed.toLowerCase() === host)
      );
    }

    if (!LOOPBACK_ADDRESSES.has(req.socket?.localAddress ?? '')) return true;
    // A local reverse proxy forwards the public host name. A browser can't add these
    // headers to a cross-origin request without a CORS preflight, which a rebound page fails.
    if (
      req.headers['x-forwarded-host'] ||
      req.headers['x-forwarded-for'] ||
      req.headers['forwarded']
    ) {
      return true;
    }
    if (!host) return false;
    try {
      return LOOPBACK_HOSTNAMES.has(new URL(`http://${host}`).hostname);
    } catch {
      return false;
    }
  }

  private async authenticateRequest(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ): Promise<boolean> {
    if (!this.bearerTokenVerifier) return true;

    const resourceMetadataUrl = this.getResourceMetadataUrl(req);
    const requiredScopes = this.bearerAuthRequiredScopes;

    try {
      // Both arms read the verified token from `req.auth`.
      (req as { auth?: AuthInfo }).auth = await verifyBearerToken(
        req.headers.authorization,
        {
          verifier: this.bearerTokenVerifier,
          requiredScopes,
          resourceMetadataUrl,
          expectedResource: this.bearerAuthExpectedResource,
        },
      );
      return true;
    } catch (error) {
      // 401 with a `WWW-Authenticate` challenge for a bad token, 403 for missing scopes.
      await this.sendWebResponse(
        res,
        bearerAuthChallengeResponse(this.asOAuthError(error), {
          requiredScopes,
          resourceMetadataUrl,
        }),
      );
      return false;
    }
  }

  /**
   * v1-style OAuth errors (`InvalidTokenError` and friends, still exported by
   * `@modelcontextprotocol/server-legacy`) carry their code in `errorCode` and aren't the
   * SDK's `OAuthError`, which the SDK would answer with a 500. Translate them, and say so
   * once, so a verifier ported by renaming its imports still gets the right challenge.
   */
  private asOAuthError(error: unknown): unknown {
    if (error instanceof OAuthError) return error;
    const errorCode = (error as { errorCode?: unknown } | null)?.errorCode;
    if (typeof errorCode !== 'string') return error;

    if (!this.warnedAboutLegacyOAuthError) {
      this.warnedAboutLegacyOAuthError = true;
      this.logger.warn(
        `The token verifier threw a v1-style OAuth error (${(error as Error).name ?? 'OAuthError'}). ` +
          'Throw OAuthError from @modelcontextprotocol/server instead; this translation is a stopgap.',
      );
    }
    return new OAuthError(
      errorCode,
      error instanceof Error ? error.message : 'Invalid access token',
    );
  }

  private async sendWebResponse(res: http.ServerResponse, response: Response) {
    res.writeHead(response.status, Object.fromEntries(response.headers));
    res.end(await response.text());
  }

  /**
   * The scopes a `tools/call` needs that the caller's token lacks, from the tool's
   * `@McpGuard(McpScopeGuard, { scopes })` guards. Checked at the HTTP layer so the client
   * gets a 403 `insufficient_scope` challenge it can act on (step-up authorization), rather
   * than a tool error it can't.
   */
  private getMissingToolScopes(
    req: http.IncomingMessage,
    body: unknown,
  ): string[] {
    const authInfo = (req as { auth?: AuthInfo }).auth;
    if (!this.bearerTokenVerifier || !authInfo) return [];
    if (!body || typeof body !== 'object' || Array.isArray(body)) return [];

    const message = body as { method?: unknown; params?: { name?: unknown } };
    if (
      message.method !== 'tools/call' ||
      typeof message.params?.name !== 'string'
    ) {
      return [];
    }

    const required = this.registry.getToolRequiredScopes(message.params.name);

    return required.filter((scope) => !authInfo.scopes.includes(scope));
  }

  private sendInsufficientScope(
    req: http.IncomingMessage,
    res: http.ServerResponse,
    missingScopes: string[],
  ) {
    const authInfo = (req as { auth?: AuthInfo }).auth;
    // Everything this call needs, so one round of consent is enough.
    const scope = [
      ...new Set([
        ...this.bearerAuthRequiredScopes,
        ...(authInfo?.scopes ?? []),
        ...missingScopes,
      ]),
    ].join(' ');
    const description = `Missing required scopes: ${missingScopes.join(' ')}`;
    const resourceMetadataUrl = this.getResourceMetadataUrl(req);

    res.writeHead(403, {
      'Content-Type': 'application/json',
      'WWW-Authenticate':
        `Bearer error="insufficient_scope", error_description="${description}", scope="${scope}"` +
        (resourceMetadataUrl
          ? `, resource_metadata="${resourceMetadataUrl}"`
          : ''),
    });
    res.end(
      JSON.stringify({
        error: 'insufficient_scope',
        error_description: description,
      }),
    );
  }

  private getResourceMetadataUrl(
    req: http.IncomingMessage,
  ): string | undefined {
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

    return new URL(`/${metadataSegments.join('/')}`, origin).href;
  }

  private getRequestPath(req: http.IncomingMessage): string {
    const rawUrl =
      typeof (req as any).originalUrl === 'string'
        ? (req as any).originalUrl
        : (req.url ?? '');

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

  /**
   * Whether a POST comes from a 2025-era client, by the SDK's own classification. The body is
   * already parsed, so the probe only needs the method and headers.
   */
  private isLegacyPost(
    req: http.IncomingMessage,
    parsedBody: unknown,
  ): Promise<boolean> {
    const headers = new Headers();
    for (const [name, value] of Object.entries(req.headers)) {
      if (value === undefined) continue;
      for (const item of Array.isArray(value) ? value : [value]) {
        headers.append(name, item);
      }
    }
    return isLegacyRequest(
      new Request('http://localhost/mcp', { method: 'POST', headers }),
      parsedBody,
    );
  }

  private sendJsonRpcError(
    res: http.ServerResponse,
    status: number,
    code: number,
    message: string,
    headers: Record<string, string> = {},
  ) {
    res.writeHead(status, { 'Content-Type': 'application/json', ...headers });
    res.end(
      JSON.stringify({
        jsonrpc: '2.0',
        error: { code, message },
        id: null,
      }),
    );
  }

  async handleRequest(req: http.IncomingMessage, res: http.ServerResponse) {
    if (!this.isHostAllowed(req)) {
      this.sendJsonRpcError(
        res,
        403,
        -32600,
        `Host "${req.headers.host ?? ''}" is not allowed`,
      );
      return;
    }

    if (!this.isOriginAllowed(req)) {
      this.sendJsonRpcError(
        res,
        403,
        -32600,
        `Origin "${req.headers['origin']}" is not allowed`,
      );
      return;
    }

    // A stateless server issues no session IDs, so it ignores any it is sent.
    const sessionId = this.stateful
      ? (req.headers['mcp-session-id'] as string | undefined)
      : undefined;

    try {
      // A stateless server has no standalone stream to open and no session to delete.
      if (!this.stateful && (req.method === 'GET' || req.method === 'DELETE')) {
        this.sendJsonRpcError(res, 405, -32000, 'Method not allowed', {
          Allow: 'POST, OPTIONS',
        });
        return;
      }

      if (req.method !== 'OPTIONS') {
        const authenticated = await this.authenticateRequest(req, res);
        if (!authenticated) return;
      }

      if (!req.headers.accept) {
        req.headers.accept =
          req.method === 'GET'
            ? 'text/event-stream'
            : 'application/json, text/event-stream';
      }

      const parsedBody = (req as any).body;

      if (req.method === 'POST') {
        const missingScopes = this.getMissingToolScopes(req, parsedBody);
        if (missingScopes.length > 0) {
          this.sendInsufficientScope(req, res, missingScopes);
          return;
        }
      }

      // 2026-07-28 requests carry their protocol version in `_meta`; everything else
      // (`initialize`, session traffic, GET and DELETE) is a 2025-era client's.
      if (
        req.method === 'POST' &&
        !(await this.isLegacyPost(req, parsedBody))
      ) {
        await this.modernNode(req, res, parsedBody);
        return;
      }

      const isInitializeRequest =
        req.method === 'POST' && this.isInitializeRequestBody(parsedBody);
      const principal = this.getPrincipal(req);

      if (req.method === 'POST' && !sessionId) {
        const session = this.createLegacySession(principal);
        this.closeIfNotStoredWhenResponseCloses(session, res);
        await session.transport.handleRequest(req, res, parsedBody);
        return;
      }

      if (!sessionId) {
        this.sendJsonRpcError(
          res,
          400,
          -32600,
          'Missing Mcp-Session-Id header',
        );
        return;
      }

      const stored = this.sessions.get(sessionId);
      // A session belongs to whoever opened it; to anyone else it doesn't exist.
      const session =
        stored && stored.principal === principal ? stored : undefined;
      if (stored && !session) {
        this.logger.warn(
          `Rejected a request for session ${sessionId} from a different principal`,
        );
      }

      if (!session) {
        if (isInitializeRequest) {
          const newSession = this.createLegacySession(principal);
          this.closeIfNotStoredWhenResponseCloses(newSession, res);
          await newSession.transport.handleRequest(req, res, parsedBody);
          return;
        }

        this.sendJsonRpcError(res, 404, -32001, 'Session not found');
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
        this.sendJsonRpcError(res, 500, -32603, 'Internal error');
      }
    }
  }

  /**
   * A server created for a request that doesn't become a stored session (stateless mode,
   * or a stateful request that never initialized) lives only as long as its response.
   * Unwire it from the registry and close it then, so listeners don't pile up.
   */
  private closeIfNotStoredWhenResponseCloses(
    session: SessionEntry,
    res: http.ServerResponse,
  ) {
    res.once('close', () => {
      if (session.sessionId) return;
      session.unsubscribeRegistry();
      session.transport
        .close()
        .catch((error) => this.logger.error('Error closing transport:', error));
      session.server
        .close()
        .catch((error) => this.logger.error('Error closing server:', error));
    });
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
      this.logger.error(
        `Error closing transport for session ${sessionId}:`,
        error,
      );
    }
    try {
      await session.server.close();
    } catch (error) {
      this.logger.error(
        `Error closing server for session ${sessionId}:`,
        error,
      );
    }
    this.logger.log(`Session closed: ${sessionId}`);
  }

  async onModuleDestroy() {
    clearInterval(this.sweepInterval);
    this.unsubscribeModern();
    try {
      await this.modern.close();
    } catch (error) {
      this.logger.error('Error closing the MCP handler:', error);
    }
    for (const [sessionId, session] of this.sessions) {
      await this.closeSession(sessionId, session);
    }
    this.sessions.clear();
    this.logger.log('All MCP sessions closed');
  }
}
