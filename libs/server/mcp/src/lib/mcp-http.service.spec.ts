import { McpHttpService } from './mcp-http.service';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpScopeGuard } from './mcp-scope-guard';
import {
  InsufficientScopeError,
  InvalidTokenError,
} from '@modelcontextprotocol/server-legacy/auth';
import type { McpModuleConfig } from './mcp-module-config';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/server';
import { EventEmitter } from 'events';

const mockTransportHandleRequest = jest.fn().mockResolvedValue(undefined);
const mockTransportClose = jest.fn().mockResolvedValue(undefined);
const mockServerRegisterTool = jest.fn();
const mockServerRegisterResource = jest.fn();
const mockServerRegisterPrompt = jest.fn();
const mockServerConnect = jest.fn();
const mockServerClose = jest.fn().mockResolvedValue(undefined);

let capturedOnSessionInitialized: ((sessionId: string) => void) | undefined;
let capturedTransportOptions: any;

/** A response header the service wrote with `writeHead`, by case-insensitive name. */
function sentHeader(res: any, name: string): string | undefined {
  for (const [, headers] of res.writeHead.mock.calls) {
    for (const [key, value] of Object.entries(headers ?? {})) {
      if (key.toLowerCase() === name.toLowerCase()) return value as string;
    }
  }
  return undefined;
}

/** The JSON body the service sent with `end`. */
function sentJson(res: any): unknown {
  return JSON.parse(res.end.mock.calls[0][0]);
}

/** A JSON-RPC request without the 2026-07-28 `_meta` envelope: a 2025-era client's. */
const LEGACY_BODY = { jsonrpc: '2.0', id: 1, method: 'tools/list' };

jest.mock('@modelcontextprotocol/server', () => ({
  ...jest.requireActual('@modelcontextprotocol/server'),
  McpServer: jest.fn().mockImplementation(() => ({
    isConnected: jest.fn().mockReturnValue(false),
    registerTool: mockServerRegisterTool,
    registerResource: mockServerRegisterResource,
    registerPrompt: mockServerRegisterPrompt,
    connect: mockServerConnect,
    close: mockServerClose,
    server: {
      setRequestHandler: jest.fn(),
      registerCapabilities: jest.fn(),
      getClientCapabilities: jest.fn().mockReturnValue({}),
      sendResourceUpdated: jest.fn().mockResolvedValue(undefined),
      notification: jest.fn().mockResolvedValue(undefined),
    },
    sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
  })),
  ResourceTemplate: jest.fn(),
}));

jest.mock('@modelcontextprotocol/node', () => ({
  ...jest.requireActual('@modelcontextprotocol/node'),
  NodeStreamableHTTPServerTransport: jest
    .fn()
    .mockImplementation((opts: any) => {
      capturedTransportOptions = opts;
      capturedOnSessionInitialized = opts.onsessioninitialized;
      return {
        handleRequest: mockTransportHandleRequest,
        close: mockTransportClose,
      };
    }),
}));

describe('McpHttpService', () => {
  let service: McpHttpService;
  let registry: McpToolRegistry;
  // Stateful, since most of these tests exercise sessions; stateless mode has its own tests.
  const config: McpModuleConfig = {
    metadata: { name: 'test-server', version: '1.0.0' },
    session: {},
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnSessionInitialized = undefined;
    capturedTransportOptions = undefined;
    registry = new McpToolRegistry();
    service = new McpHttpService(config as any, registry);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('handleRequest', () => {
    function mockReq(
      overrides: Partial<{
        method: string;
        headers: Record<string, string>;
        body: any;
        url: string;
        originalUrl: string;
      }> = {},
    ) {
      return {
        method: overrides.method ?? 'POST',
        headers: overrides.headers ?? {},
        body: overrides.body ?? LEGACY_BODY,
        url: overrides.url,
        originalUrl: overrides.originalUrl,
      } as any;
    }

    function mockRes() {
      return Object.assign(new EventEmitter(), {
        writeHead: jest.fn(),
        end: jest.fn(),
        set: jest.fn(),
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        headersSent: false,
      }) as any;
    }

    const registryListenerCount = () =>
      (registry as any).changeListeners.length +
      (registry as any).resourceUpdateListeners.length;

    it('should unwire and close the per-request server in stateless mode when the response closes', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());
      // The service's own subscriptions, which notify 2026-07-28 clients.
      const baseline = registryListenerCount();

      for (let i = 0; i < 5; i++) {
        const res = mockRes();
        await service.handleRequest(mockReq(), res);
        res.emit('close');
      }
      await new Promise((r) => setImmediate(r));

      expect(registryListenerCount()).toBe(baseline);
      expect(mockTransportClose).toHaveBeenCalledTimes(5);
      expect(mockServerClose).toHaveBeenCalledTimes(5);
    });

    it('should keep an initialized stateful session wired after the response closes', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());
      const baseline = registryListenerCount();

      const res = mockRes();
      await service.handleRequest(mockReq(), res);
      capturedOnSessionInitialized!('kept-session');
      res.emit('close');
      await new Promise((r) => setImmediate(r));

      expect((service as any).sessions.has('kept-session')).toBe(true);
      expect(registryListenerCount()).toBe(baseline + 2);
      expect(mockTransportClose).not.toHaveBeenCalled();
    });

    it('should return 400 for non-POST without session ID', async () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400, {
        'Content-Type': 'application/json',
      });
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error.message).toContain('Missing Mcp-Session-Id');
    });

    it('should return 404 for invalid session ID', async () => {
      const req = mockReq({ headers: { 'mcp-session-id': 'nonexistent' } });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(404, {
        'Content-Type': 'application/json',
      });
    });

    it('should create a session on POST without session ID', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      const req = mockReq();
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(mockTransportHandleRequest).toHaveBeenCalledWith(
        req,
        res,
        req.body,
      );
      expect(mockServerConnect).toHaveBeenCalled();
    });

    it('should create a fresh session for initialize requests with a stale session ID header', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      const req = mockReq({
        headers: { 'mcp-session-id': 'stale-session' },
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: { name: 'test', version: '1.0.0' },
          },
        },
      });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(mockTransportHandleRequest).toHaveBeenCalledWith(
        req,
        res,
        req.body,
      );
      expect(mockServerConnect).toHaveBeenCalled();
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('should set default Accept header for POST if missing', async () => {
      const req = mockReq();
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(req.headers.accept).toBe('application/json, text/event-stream');
    });

    it('should set default Accept header for GET if missing', async () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();

      await service.handleRequest(req, res);

      // GET without session ID returns 400, but Accept should have been set first
      expect(req.headers.accept).toBe('text/event-stream');
    });

    it('should delegate to transport for valid session', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      // Create a session first
      const initReq = mockReq();
      const initRes = mockRes();
      await service.handleRequest(initReq, initRes);

      // Simulate session initialization callback
      expect(capturedOnSessionInitialized).toBeDefined();
      capturedOnSessionInitialized!('test-session-123');

      // Now make a request with the session ID
      mockTransportHandleRequest.mockClear();
      const req = mockReq({
        headers: { 'mcp-session-id': 'test-session-123' },
      });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(mockTransportHandleRequest).toHaveBeenCalledWith(
        req,
        res,
        req.body,
      );
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('should clean up session on DELETE even if transport throws', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      // Create session
      const initReq = mockReq();
      await service.handleRequest(initReq, mockRes());
      capturedOnSessionInitialized!('delete-session');

      // Make DELETE throw from transport
      mockTransportHandleRequest.mockRejectedValueOnce(
        new Error('transport error'),
      );

      const req = mockReq({
        method: 'DELETE',
        headers: { 'mcp-session-id': 'delete-session' },
      });
      const res = mockRes();

      // The outer catch should handle the error
      await service.handleRequest(req, res);

      // Session should still be cleaned up
      expect(mockTransportClose).toHaveBeenCalled();
      expect(mockServerClose).toHaveBeenCalled();

      // Subsequent request with same session ID should get 404
      mockTransportHandleRequest.mockClear();
      const req2 = mockReq({ headers: { 'mcp-session-id': 'delete-session' } });
      const res2 = mockRes();
      await service.handleRequest(req2, res2);
      expect(res2.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });

    it('should update lastActivity on valid session requests', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      const initReq = mockReq();
      await service.handleRequest(initReq, mockRes());
      capturedOnSessionInitialized!('activity-session');

      // Make a request — should not error (lastActivity gets updated internally)
      const req = mockReq({
        headers: { 'mcp-session-id': 'activity-session' },
      });
      const res = mockRes();
      await service.handleRequest(req, res);

      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('should return 500 on unexpected errors', async () => {
      // Force createSession to throw by making McpServer constructor throw
      const { McpServer } = require('@modelcontextprotocol/server');
      McpServer.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const req = mockReq();
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(500, {
        'Content-Type': 'application/json',
      });
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error.code).toBe(-32603);
    });

    it('should return 401 with WWW-Authenticate when bearer auth is required and Authorization is missing', async () => {
      const verifier: OAuthTokenVerifier = {
        verifyAccessToken: jest.fn(),
      };
      service.setBearerAuthVerifier(verifier);

      const req = mockReq({ headers: { host: 'api.example.com' } });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(sentHeader(res, 'WWW-Authenticate')).toEqual(
        expect.stringContaining(
          'resource_metadata="http://api.example.com/.well-known/oauth-protected-resource/mcp"',
        ),
      );
      expect(res.writeHead).toHaveBeenCalledWith(401, expect.anything());
      expect(sentJson(res)).toEqual(
        expect.objectContaining({
          error: 'invalid_token',
        }),
      );
      expect(mockTransportHandleRequest).not.toHaveBeenCalled();
    });

    it('should derive path-specific resource metadata URLs from custom route requests', async () => {
      const verifier: OAuthTokenVerifier = {
        verifyAccessToken: jest.fn(),
      };
      service = new McpHttpService(
        { ...config, route: 'internal/mcp' } as any,
        registry,
      );
      service.setBearerAuthVerifier(verifier);

      const req = mockReq({
        headers: { host: 'api.example.com' },
        originalUrl: '/internal/mcp?transport=streamable-http',
      });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(sentHeader(res, 'WWW-Authenticate')).toEqual(
        expect.stringContaining(
          'resource_metadata="http://api.example.com/.well-known/oauth-protected-resource/internal/mcp"',
        ),
      );
    });

    it('should include Nest global prefix in path-specific resource metadata URLs', async () => {
      const verifier: OAuthTokenVerifier = {
        verifyAccessToken: jest.fn(),
      };
      service = new McpHttpService(
        { ...config, route: 'internal/mcp' } as any,
        registry,
      );
      service.setBearerAuthVerifier(verifier);

      const req = mockReq({
        headers: { host: 'api.example.com' },
        originalUrl: '/api/internal/mcp',
      });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(sentHeader(res, 'WWW-Authenticate')).toEqual(
        expect.stringContaining(
          'resource_metadata="http://api.example.com/api/.well-known/oauth-protected-resource/api/internal/mcp"',
        ),
      );
    });

    it('should prefer a configured absolute resource metadata URL', async () => {
      const verifier: OAuthTokenVerifier = {
        verifyAccessToken: jest.fn(),
      };
      service.setBearerAuthVerifier(verifier, {
        resourceMetadataUrl: 'https://metadata.example.com/prm',
      });

      const req = mockReq({ headers: { host: 'api.example.com' } });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(sentHeader(res, 'WWW-Authenticate')).toEqual(
        expect.stringContaining(
          'resource_metadata="https://metadata.example.com/prm"',
        ),
      );
    });

    it('should resolve a configured root-relative resource metadata URL against the request origin', async () => {
      const verifier: OAuthTokenVerifier = {
        verifyAccessToken: jest.fn(),
      };
      service.setBearerAuthVerifier(verifier, {
        resourceMetadataUrl: '/.well-known/oauth-protected-resource',
      });

      const req = mockReq({ headers: { host: 'api.example.com' } });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(sentHeader(res, 'WWW-Authenticate')).toEqual(
        expect.stringContaining(
          'resource_metadata="http://api.example.com/.well-known/oauth-protected-resource"',
        ),
      );
    });

    it('should allow requests through when bearer auth succeeds', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      const verifier: OAuthTokenVerifier = {
        verifyAccessToken: jest.fn().mockResolvedValue({
          token: 'valid-token',
          clientId: 'client-1',
          scopes: [],
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
        }),
      };
      service.setBearerAuthVerifier(verifier);

      const req = mockReq({
        headers: { authorization: 'Bearer valid-token' },
      });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(verifier.verifyAccessToken).toHaveBeenCalledWith('valid-token');
      expect(mockTransportHandleRequest).toHaveBeenCalledWith(
        req,
        res,
        req.body,
      );
      expect((req as any).auth).toEqual(
        expect.objectContaining({
          token: 'valid-token',
          clientId: 'client-1',
        }),
      );
    });
  });

  describe('v1-style OAuth errors from a verifier', () => {
    it.each([
      [
        'InvalidTokenError',
        new InvalidTokenError('expired'),
        401,
        'invalid_token',
      ],
      [
        'InsufficientScopeError',
        new InsufficientScopeError('needs write'),
        403,
        'insufficient_scope',
      ],
    ])(
      'answers %s with its challenge, not a 500',
      async (_name, failure, status, code) => {
        const warn = jest
          .spyOn((service as any).logger, 'warn')
          .mockImplementation(() => undefined);
        service.setBearerAuthVerifier({
          verifyAccessToken: jest.fn().mockRejectedValue(failure),
        });

        const first = mockRes();
        const second = mockRes();
        await service.handleRequest(
          mockReq({
            headers: { authorization: 'Bearer t', host: 'api.example.com' },
          }),
          first,
        );
        await service.handleRequest(
          mockReq({
            headers: { authorization: 'Bearer t', host: 'api.example.com' },
          }),
          second,
        );

        expect(first.writeHead).toHaveBeenCalledWith(status, expect.anything());
        expect(sentHeader(first, 'WWW-Authenticate')).toContain(
          `error="${code}"`,
        );
        // Said once, not on every request.
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toContain('Throw OAuthError');
      },
    );
  });

  describe('DNS rebinding protection', () => {
    let protectedService: McpHttpService;

    beforeEach(() => {
      protectedService = new McpHttpService(
        {
          ...config,
          allowedOrigins: ['http://localhost:3000', 'https://app.example.com'],
        } as any,
        registry,
      );
    });

    afterEach(async () => {
      await protectedService.onModuleDestroy();
    });

    it('should reject requests with disallowed Origin', async () => {
      const req = mockReq({ headers: { origin: 'https://evil.com' } });
      const res = mockRes();

      await protectedService.handleRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(403, {
        'Content-Type': 'application/json',
      });
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error.message).toContain('not allowed');
    });

    it('should allow requests with an allowed Origin', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());
      const req = mockReq({ headers: { origin: 'http://localhost:3000' } });
      const res = mockRes();

      await protectedService.handleRequest(req, res);

      // Should not get 403 — proceeds to create session
      expect(res.writeHead).not.toHaveBeenCalledWith(403, expect.anything());
      expect(mockTransportHandleRequest).toHaveBeenCalled();
    });

    it('should allow requests with no Origin header', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());
      const req = mockReq();
      const res = mockRes();

      await protectedService.handleRequest(req, res);

      expect(res.writeHead).not.toHaveBeenCalledWith(403, expect.anything());
      expect(mockTransportHandleRequest).toHaveBeenCalled();
    });

    it('should allow any origin when allowedOrigins includes *', async () => {
      const openService = new McpHttpService(
        { ...config, allowedOrigins: ['*'] } as any,
        registry,
      );
      const res = mockRes();

      await openService.handleRequest(
        mockReq({ headers: { origin: 'https://anything.com' } }),
        res,
      );

      expect(res.writeHead).not.toHaveBeenCalledWith(403, expect.anything());
      await openService.onModuleDestroy();
    });

    it('should reject a cross-origin request when allowedOrigins is not configured', async () => {
      const res = mockRes();

      await service.handleRequest(
        mockReq({
          headers: { origin: 'https://evil.example', host: 'mcp.example.com' },
        }),
        res,
      );

      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
      expect(mockTransportHandleRequest).not.toHaveBeenCalled();
    });

    it('should allow a same-origin request when allowedOrigins is not configured', async () => {
      const res = mockRes();

      await service.handleRequest(
        mockReq({
          headers: {
            origin: 'https://mcp.example.com',
            'x-forwarded-host': 'mcp.example.com',
            host: 'internal:3000',
          },
        }),
        res,
      );

      expect(res.writeHead).not.toHaveBeenCalledWith(403, expect.anything());
      expect(mockTransportHandleRequest).toHaveBeenCalled();
    });

    it('should compare the origin with Host only when trustForwardedHosts is false', async () => {
      const strictService = new McpHttpService(
        { ...config, trustForwardedHosts: false } as any,
        registry,
      );
      const spoofed = mockRes();
      const sameHost = mockRes();

      await strictService.handleRequest(
        mockReq({
          headers: {
            origin: 'https://mcp.example.com',
            'x-forwarded-host': 'mcp.example.com',
            host: 'internal:3000',
          },
        }),
        spoofed,
      );
      await strictService.handleRequest(
        mockReq({
          headers: {
            origin: 'https://mcp.example.com',
            'x-forwarded-host': 'other.example.com',
            host: 'mcp.example.com',
          },
        }),
        sameHost,
      );

      expect(spoofed.writeHead).toHaveBeenCalledWith(403, expect.anything());
      expect(sameHost.writeHead).not.toHaveBeenCalledWith(
        403,
        expect.anything(),
      );
      await strictService.onModuleDestroy();
    });
  });

  describe('Host validation', () => {
    const loopback = { localAddress: '127.0.0.1' };

    it('should reject a non-loopback host on a loopback socket (DNS rebinding)', async () => {
      const res = mockRes();
      const req = mockReq({ headers: { host: 'evil.example:3000' } });
      req.socket = loopback;

      await service.handleRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(403, expect.anything());
      expect(mockTransportHandleRequest).not.toHaveBeenCalled();
    });

    it('should accept localhost on a loopback socket', async () => {
      const res = mockRes();
      const req = mockReq({ headers: { host: 'localhost:3000' } });
      req.socket = loopback;

      await service.handleRequest(req, res);

      expect(mockTransportHandleRequest).toHaveBeenCalled();
    });

    it('should accept a forwarded request from a local reverse proxy', async () => {
      const res = mockRes();
      const req = mockReq({
        headers: { host: 'mcp.example.com', 'x-forwarded-for': '203.0.113.9' },
      });
      req.socket = loopback;

      await service.handleRequest(req, res);

      expect(mockTransportHandleRequest).toHaveBeenCalled();
    });

    it('should log the Host in the forwarded-host warning without control characters, truncated', async () => {
      const warn = jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      const req = mockReq({
        headers: {
          host: `evil\r\n\u0007${'a'.repeat(300)}`,
          'x-forwarded-for': '203.0.113.9',
        },
      });
      req.socket = loopback;

      await service.handleRequest(req, mockRes());

      expect(warn).toHaveBeenCalledTimes(1);
      const message = warn.mock.calls[0][0] as string;
      expect(message).toContain(`Host "evil${'a'.repeat(96)}..."`);
      expect(message).not.toMatch(/[\u0000-\u001f]/);
    });

    it('should only accept listed hosts when allowedHosts is set', async () => {
      const hostService = new McpHttpService(
        { ...config, allowedHosts: ['mcp.example.com'] } as any,
        registry,
      );
      const rejected = mockRes();
      const accepted = mockRes();

      await hostService.handleRequest(
        mockReq({ headers: { host: 'other.example.com' } }),
        rejected,
      );
      await hostService.handleRequest(
        mockReq({ headers: { host: 'MCP.example.com' } }),
        accepted,
      );

      expect(rejected.writeHead).toHaveBeenCalledWith(403, expect.anything());
      expect(accepted.writeHead).not.toHaveBeenCalledWith(
        403,
        expect.anything(),
      );
      await hostService.onModuleDestroy();
    });
  });

  describe('stateless mode', () => {
    let stateless: McpHttpService;

    beforeEach(() => {
      stateless = new McpHttpService(
        { metadata: config.metadata } as any,
        registry,
      );
    });

    afterEach(async () => {
      await stateless.onModuleDestroy();
    });

    it.each(['GET', 'DELETE'])(
      'should answer %s with 405, since there is no stream or session',
      async (method) => {
        const res = mockRes();

        await stateless.handleRequest(
          { method, headers: {}, body: undefined } as any,
          res,
        );

        expect(res.writeHead).toHaveBeenCalledWith(
          405,
          expect.objectContaining({ Allow: 'POST, OPTIONS' }),
        );
        expect(mockTransportHandleRequest).not.toHaveBeenCalled();
      },
    );

    it('should ignore an Mcp-Session-Id header and serve the POST', async () => {
      const res = mockRes();

      await stateless.handleRequest(
        {
          method: 'POST',
          headers: { 'mcp-session-id': 'left-over' },
          body: LEGACY_BODY,
        } as any,
        res,
      );

      expect(res.writeHead).not.toHaveBeenCalledWith(404, expect.anything());
      expect(mockTransportHandleRequest).toHaveBeenCalled();
    });
  });

  describe('session ownership', () => {
    function verifierFor(sub: string): OAuthTokenVerifier {
      return {
        verifyAccessToken: jest.fn().mockResolvedValue({
          token: 't',
          clientId: 'shared-client',
          scopes: [],
          expiresAt: Math.floor(Date.now() / 1000) + 3600,
          extra: { sub },
        }),
      };
    }

    async function openAs(sub: string, sessionId: string) {
      service.setBearerAuthVerifier(verifierFor(sub));
      await service.handleRequest(
        {
          method: 'POST',
          headers: { authorization: 'Bearer t' },
          body: LEGACY_BODY,
        } as any,
        Object.assign(new EventEmitter(), {
          writeHead: jest.fn(),
          end: jest.fn(),
          set: jest.fn(),
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        }) as any,
      );
      capturedOnSessionInitialized!(sessionId);
    }

    it('should serve the session to the user who opened it', async () => {
      await openAs('alice', 's-alice');
      mockTransportHandleRequest.mockClear();

      const res = mockRes();
      await service.handleRequest(
        {
          method: 'POST',
          headers: { authorization: 'Bearer t', 'mcp-session-id': 's-alice' },
          body: LEGACY_BODY,
        } as any,
        res,
      );

      expect(mockTransportHandleRequest).toHaveBeenCalled();
    });

    it('should answer 404 to another user presenting the session id', async () => {
      jest
        .spyOn((service as any).logger, 'warn')
        .mockImplementation(() => undefined);
      await openAs('alice', 's-alice');
      service.setBearerAuthVerifier(verifierFor('mallory'));
      mockTransportHandleRequest.mockClear();

      const res = mockRes();
      await service.handleRequest(
        {
          method: 'POST',
          headers: { authorization: 'Bearer t', 'mcp-session-id': 's-alice' },
          body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
        } as any,
        res,
      );

      expect(res.writeHead).toHaveBeenCalledWith(404, expect.anything());
      expect(mockTransportHandleRequest).not.toHaveBeenCalled();
    });
  });

  describe('scope challenges', () => {
    beforeEach(() => {
      registry.registerTool(
        { name: 'delete-item', description: 'd' },
        jest.fn(),
        [{ guardClass: McpScopeGuard, config: { scopes: ['items:write'] } }],
      );
      service.setBearerAuthVerifier(
        {
          verifyAccessToken: jest.fn().mockResolvedValue({
            token: 't',
            clientId: 'c',
            scopes: ['items:read'],
            expiresAt: Math.floor(Date.now() / 1000) + 3600,
          }),
        },
        { resourceMetadataUrl: 'https://mcp.example.com/.well-known/prm' },
      );
    });

    function callTool(name: string) {
      return {
        method: 'POST',
        headers: { authorization: 'Bearer t' },
        body: {
          jsonrpc: '2.0',
          id: 1,
          method: 'tools/call',
          params: { name, arguments: {} },
        },
      } as any;
    }

    it('should answer 403 insufficient_scope with the scopes the call needs', async () => {
      const res = mockRes();

      await service.handleRequest(callTool('delete-item'), res);

      expect(res.writeHead).toHaveBeenCalledWith(403, {
        'Content-Type': 'application/json',
        'WWW-Authenticate':
          'Bearer error="insufficient_scope", error_description="Missing required scopes: items:write", scope="items:read items:write", resource_metadata="https://mcp.example.com/.well-known/prm"',
      });
      expect(mockTransportHandleRequest).not.toHaveBeenCalled();
    });

    it('should let through calls to tools whose scopes the token has', async () => {
      registry.registerTool(
        { name: 'read-item', description: 'd' },
        jest.fn(),
        [{ guardClass: McpScopeGuard, config: { scopes: ['items:read'] } }],
      );
      const res = mockRes();

      await service.handleRequest(callTool('read-item'), res);

      expect(res.writeHead).not.toHaveBeenCalledWith(403, expect.anything());
      expect(mockTransportHandleRequest).toHaveBeenCalled();
    });
  });

  describe('transport options', () => {
    it('should forward session eventStore to transport when provided', async () => {
      const mockEventStore = {
        storeEvent: jest.fn(),
        replayEventsAfter: jest.fn(),
      };
      const customService = new McpHttpService(
        { ...config, session: { eventStore: mockEventStore } } as any,
        registry,
      );

      await customService.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.eventStore).toBe(mockEventStore);
      await customService.onModuleDestroy();
    });

    it('should not include eventStore when not configured', async () => {
      await service.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.eventStore).toBeUndefined();
    });

    it('should default enableJsonResponse to false (SSE responses) when not configured', async () => {
      await service.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.enableJsonResponse).toBe(false);
    });

    it('should forward enableJsonResponse as true when set in config', async () => {
      const customService = new McpHttpService(
        { ...config, enableJsonResponse: true } as any,
        registry,
      );

      await customService.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.enableJsonResponse).toBe(true);
      await customService.onModuleDestroy();
    });

    it('should default to stateless mode when session is not configured', async () => {
      const statelessService = new McpHttpService(
        { metadata: config.metadata } as any,
        registry,
      );

      await statelessService.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.sessionIdGenerator).toBeUndefined();
      await statelessService.onModuleDestroy();
    });

    it('should use default session id generator when session is configured without idGenerator', async () => {
      const customService = new McpHttpService(
        { ...config, session: {} } as any,
        registry,
      );

      await customService.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.sessionIdGenerator).toBeInstanceOf(
        Function,
      );
      expect(typeof capturedTransportOptions.sessionIdGenerator()).toBe(
        'string',
      );
      await customService.onModuleDestroy();
    });

    it('should forward custom session idGenerator when session is configured', async () => {
      const customGenerator = () => 'custom-session-id';
      const customService = new McpHttpService(
        { ...config, session: { idGenerator: customGenerator } } as any,
        registry,
      );

      await customService.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.sessionIdGenerator).toBe(customGenerator);
      await customService.onModuleDestroy();
    });
  });

  describe('session TTL', () => {
    it('should use custom TTL from session config', () => {
      const customService = new McpHttpService(
        { ...config, session: { ttlMinutes: 5 } } as any,
        new McpToolRegistry(),
      );

      // Access private field via any to verify
      expect((customService as any).sessionTtlMs).toBe(5 * 60 * 1000);

      // Clean up
      customService.onModuleDestroy();
    });

    it('should default to 30 minutes if not configured', () => {
      expect((service as any).sessionTtlMs).toBe(30 * 60 * 1000);
    });
  });

  describe('onModuleDestroy', () => {
    it('should close all sessions and clear the map', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      // Create two sessions
      await service.handleRequest(mockReq(), mockRes());
      capturedOnSessionInitialized!('session-1');
      await service.handleRequest(mockReq(), mockRes());
      capturedOnSessionInitialized!('session-2');

      mockTransportClose.mockClear();
      mockServerClose.mockClear();

      await service.onModuleDestroy();

      expect(mockTransportClose).toHaveBeenCalledTimes(2);
      expect(mockServerClose).toHaveBeenCalledTimes(2);
    });

    it('should handle errors during session cleanup gracefully', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      await service.handleRequest(mockReq(), mockRes());
      capturedOnSessionInitialized!('error-session');

      mockTransportClose.mockRejectedValueOnce(new Error('close failed'));

      // Should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
    });

    it('should clean up resource subscriptions on session close', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      await service.handleRequest(mockReq(), mockRes());
      capturedOnSessionInitialized!('sub-session');

      // Simulate a subscription for this session
      registry.subscribeResource('app://config', 'sub-session');
      expect(
        registry.getResourceSubscribers('app://config').has('sub-session'),
      ).toBe(true);

      await service.onModuleDestroy();

      // Subscriptions should be cleaned up
      expect(registry.getResourceSubscribers('app://config').size).toBe(0);
    });
  });

  function mockReq(
    overrides: Partial<{
      method: string;
      headers: Record<string, string>;
      body: any;
    }> = {},
  ) {
    return {
      method: overrides.method ?? 'POST',
      headers: overrides.headers ?? {},
      body: overrides.body ?? LEGACY_BODY,
    } as any;
  }

  function mockRes() {
    return Object.assign(new EventEmitter(), {
      writeHead: jest.fn(),
      end: jest.fn(),
      headersSent: false,
    }) as any;
  }
});
