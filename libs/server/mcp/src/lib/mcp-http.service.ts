import { Inject, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import {
  bearerAuthChallengeResponse,
  createMcpHandler,
  OAuthError,
  isJsonContentType,
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
import * as net from 'net';
import type { McpModuleConfig } from './mcp-module-config';
import { MCP_MODULE_CONFIG } from './mcp-module-config-token';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpAuthInfo } from './mcp-auth-info';
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
 * Splits a lowercased `Host` value into its host name and port, or `undefined` when it isn't
 * a plain `host[:port]`: no userinfo, path, trailing dot, empty or out-of-range port (1-65535),
 * or stray characters. IPv6 literals keep their brackets (`[::1]`).
 */
function parseHost(
  value: string,
): { hostname: string; port?: string } | undefined {
  const match =
    /^(\[[0-9a-f:.]+\]|[a-z0-9_-]+(?:\.[a-z0-9_-]+)*)(?::(\d{1,5}))?$/.exec(
      value,
    );
  if (!match) return undefined;
  const [, hostname, port] = match;
  if (hostname.startsWith('[') && !net.isIPv6(hostname.slice(1, -1))) {
    return undefined;
  }
  if (port !== undefined && (Number(port) < 1 || Number(port) > 65535)) {
    return undefined;
  }
  return { hostname, port };
}

/**
 * Whether a lowercased `Host` header matches an `allowedHosts` entry: the whole value,
 * case-insensitive (as before), or, for an entry without a port, the host name on any port.
 */
function hostMatches(allowed: string, host: string): boolean {
  const entryValue = allowed.toLowerCase();
  if (entryValue === host) return true;
  const entry = parseHost(entryValue);
  if (!entry || entry.port !== undefined) return false;
  return parseHost(host)?.hostname === entry.hostname;
}

/** A request header value made safe to log: control characters removed, length bounded. */
function forLog(value: string | undefined, maxLength = 100): string {
  // eslint-disable-next-line no-control-regex
  const clean = (value ?? '').replace(/[\u0000-\u001f\u007f-\u009f]/g, '');
  return clean.length > maxLength ? `${clean.slice(0, maxLength)}...` : clean;
}

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
  private warnedAboutTrustedForwardedHost = false;
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
    // The visibility rules belong to whatever serves this config, so they apply however the
    // service is provided: by McpHttpModule, or by hand around a Fastify controller. Left to
    // the module, a hand-provided service would serve every tool to everyone (fail open).
    registry.setToolVisibility({
      toolVisibility: config.toolVisibility,
      toolFilter: config.toolFilter,
    });

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

    // With trustForwardedHosts: false, nothing forwarded is trusted: compare with Host only.
    const host =
      this.config.trustForwardedHosts === false
        ? this.firstHeader(req.headers.host)
        : this.getRequestHost(req);
    try {
      return !!host && new URL(origin).host === host.toLowerCase();
    } catch {
      return false;
    }
  }

  /**
   * With `allowedHosts` set, the `Host` header must match an entry. Without it, a server
   * reached on a loopback address only answers to loopback host names: a DNS-rebound page
   * reaches it under the attacker's host name (and same-origin `Origin`), which this rejects.
   * A request with forwarding headers is exempt unless `trustForwardedHosts` is `false`.
   */
  private isHostAllowed(req: http.IncomingMessage): boolean {
    const host = req.headers.host?.toLowerCase();
    const allowedHosts = this.config.allowedHosts;
    if (allowedHosts) {
      return (
        !!host && allowedHosts.some((allowed) => hostMatches(allowed, host))
      );
    }

    if (!LOOPBACK_ADDRESSES.has(req.socket?.localAddress ?? '')) return true;
    const trustForwardedHosts = this.config.trustForwardedHosts ?? true;
    if (this.isLoopbackHost(host, !trustForwardedHosts)) return true;
    // A local reverse proxy forwards the public host name. But a DNS-rebound page is
    // same-origin with the server, so it can add these headers too: trusting them is opt-out
    // now, and off by default in the next major release.
    if (
      trustForwardedHosts &&
      (req.headers['x-forwarded-host'] ||
        req.headers['x-forwarded-for'] ||
        req.headers['forwarded'])
    ) {
      if (this.config.trustForwardedHosts === undefined) {
        this.warnAboutTrustedForwardedHost(req.headers.host);
      }
      return true;
    }
    return false;
  }

  /**
   * Whether a lowercased `Host` names a loopback host. `strict` (with `trustForwardedHosts:
   * false`) parses it as `allowedHosts` does. Otherwise it is parsed as a URL authority, as in
   * earlier releases, which also reads `user@localhost`, `localhost/x`, `localhost:` and
   * `127.1` as loopback; that leniency stays for compatibility until the next major release.
   */
  private isLoopbackHost(host: string | undefined, strict: boolean): boolean {
    if (!host) return false;
    if (strict) {
      const hostname = parseHost(host)?.hostname;
      return !!hostname && LOOPBACK_HOSTNAMES.has(hostname);
    }
    try {
      return LOOPBACK_HOSTNAMES.has(new URL(`http://${host}`).hostname);
    } catch {
      return false;
    }
  }

  private warnAboutTrustedForwardedHost(host: string | undefined): void {
    if (this.warnedAboutTrustedForwardedHost) return;
    this.warnedAboutTrustedForwardedHost = true;
    this.logger.warn(
      `Accepted a request for Host "${forLog(host)}" on a loopback address because it carries forwarding headers ` +
        '(X-Forwarded-For, X-Forwarded-Host or Forwarded). A DNS-rebinding web page can add those headers itself, ' +
        'so this lets it reach the server. Behind a local reverse proxy, set allowedHosts to the host names it serves; ' +
        'with no proxy, set trustForwardedHosts: false. Setting either silences this warning. ' +
        'trustForwardedHosts defaults to true for now and becomes false in the next major release.',
    );
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
   * The scopes a `tools/call` needs that the caller lacks, from the tool's
   * `@McpGuard(McpScopeGuard, { scopes })` guards. Checked at the HTTP layer so the client
   * gets a 403 `insufficient_scope` challenge it can act on (step-up authorization), rather
   * than a tool error it can't.
   *
   * The caller's scopes are those of its auth as the auth strategy resolves it: the same
   * auth `McpScopeGuard` and tool visibility see, so a scope the strategy grants is honoured
   * here too. If the strategy throws, the token's own scopes are used (the call then fails in
   * the registry, as it would have). No challenge is sent for a disabled tool, or one
   * `toolFilter` hides from the caller: scopes aren't what stops those calls.
   */
  private async getMissingToolScopes(
    req: http.IncomingMessage,
    body: unknown,
  ): Promise<string[]> {
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

    const name = message.params.name;
    const required = this.registry.getToolRequiredScopes(name);
    // Challenge only when scopes are what stands in the way: a disabled tool can't be called
    // whatever the token carries, so the call fails as such (without revealing the tool to a
    // caller who may not see it).
    if (required.length === 0 || !this.registry.isToolEnabled(name)) return [];

    const tokenScopes = authInfo.scopes;
    let scopes = tokenScopes;
    let resolved: McpAuthInfo | undefined;
    try {
      // A copy, so auth from a transport is never trusted as already resolved.
      resolved = await this.registry.resolveAuthInfo({
        ...(authInfo as McpAuthInfo),
      });
      scopes = resolved?.scopes ?? [];
    } catch {
      // Keep the token's own scopes; tool visibility treats the caller as unauthenticated.
    }
    // Challenge only for scopes a new token could bring: ones neither the resolved auth nor the
    // token has. A scope the token carries but the strategy withholds (a deactivated user, say,
    // or a strategy that resolves to no auth) can't be fixed by stepping up, so that call goes
    // on and is refused by visibility or the guard, instead of a challenge that can never pass.
    const missing = required.filter(
      (scope) => !scopes.includes(scope) && !tokenScopes.includes(scope),
    );
    if (missing.length === 0) return [];
    // Nor when `toolFilter` hides the tool from this caller: more scopes wouldn't help, and the
    // call fails as for a tool that doesn't exist.
    if (
      this.registry.hasToolVisibilityRules() &&
      !(await this.registry.toolFilterAllows(name, resolved))
    ) {
      return [];
    }
    return missing;
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

  /**
   * Whether the request carries a body, by the same rule body parsers use: a
   * `Transfer-Encoding` header, or a `Content-Length` above zero.
   */
  private hasRequestBody(req: http.IncomingMessage): boolean {
    if (req.headers['transfer-encoding'] !== undefined) return true;
    const length = Number(req.headers['content-length']);
    return Number.isFinite(length) && length > 0;
  }

  /**
   * Whether a POST's body went unparsed: `req.body` is unset (Express 5's JSON parser leaves
   * it so for a request that isn't JSON or has no body, as does an app without body
   * parsing), or is the `{}` Express 4's parser puts there when there was nothing to parse.
   * A `{}` that came over the wire is a body, and goes to the SDK like any other.
   */
  private isUnparsedBody(req: http.IncomingMessage, body: unknown): boolean {
    if (body === undefined) return true;
    const emptyObject =
      !!body &&
      typeof body === 'object' &&
      !Array.isArray(body) &&
      Object.keys(body).length === 0;
    return emptyObject && !this.hasRequestBody(req);
  }

  /**
   * Answers a POST whose body went unparsed (see `isUnparsedBody`). Express's JSON parser
   * only skips requests that aren't JSON or have no body, so these are mostly client
   * errors, answered as the SDK's Streamable HTTP handling (`createMcpHandler`) answers
   * them:
   *
   * - a `Content-Type` that isn't `application/json`: `415`;
   * - a JSON `Content-Type` with no body: `400` Parse error (`-32700`).
   *
   * Only a JSON request that does carry a body can't be the client's fault: body parsing
   * is missing (another platform, or `bodyParser: false`), so that one is a `500`.
   */
  private rejectUnparsedBody(
    req: http.IncomingMessage,
    res: http.ServerResponse,
  ) {
    if (!isJsonContentType(req.headers['content-type'])) {
      this.sendJsonRpcError(
        res,
        415,
        -32000,
        'Unsupported Media Type: Content-Type must be application/json',
      );
      return;
    }

    if (!this.hasRequestBody(req)) {
      this.sendJsonRpcError(
        res,
        400,
        -32700,
        'Parse error: the request body is not valid JSON',
      );
      return;
    }

    this.logger.error(
      'A JSON POST arrived with its body unparsed: McpHttpModule needs the Express platform with JSON body parsing.',
    );
    this.sendJsonRpcError(
      res,
      500,
      -32603,
      'Request body not parsed. McpHttpModule requires Express platform with body-parsing middleware.',
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

      if (req.method === 'POST' && this.isUnparsedBody(req, parsedBody)) {
        this.rejectUnparsedBody(req, res);
        return;
      }

      if (req.method === 'POST') {
        const missingScopes = await this.getMissingToolScopes(req, parsedBody);
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
