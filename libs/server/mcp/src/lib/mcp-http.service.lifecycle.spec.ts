import { Logger } from '@nestjs/common';
import { EventEmitter } from 'events';
import type { OAuthTokenVerifier } from '@modelcontextprotocol/sdk/server/auth/provider.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpHttpService } from './mcp-http.service';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpModuleConfig } from './mcp-module-config';

const mockTransportHandleRequest = jest.fn().mockResolvedValue(undefined);
const mockTransportClose = jest.fn().mockResolvedValue(undefined);
const mockServerClose = jest.fn().mockResolvedValue(undefined);

let capturedOnSessionInitialized: ((sessionId: string) => void) | undefined;

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest
      .fn()
      .mockReturnValue({ enable: jest.fn(), disable: jest.fn() }),
    registerResource: jest.fn(),
    registerPrompt: jest.fn(),
    connect: jest.fn(),
    close: mockServerClose,
    server: {
      setRequestHandler: jest.fn(),
      sendResourceUpdated: jest.fn().mockResolvedValue(undefined),
      notification: jest.fn().mockResolvedValue(undefined),
    },
    sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
  })),
  ResourceTemplate: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  SubscribeRequestSchema: { method: 'resources/subscribe' },
  UnsubscribeRequestSchema: { method: 'resources/unsubscribe' },
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation((opts: any) => {
    capturedOnSessionInitialized = opts.onsessioninitialized;
    return {
      handleRequest: mockTransportHandleRequest,
      close: mockTransportClose,
    };
  }),
}));

const flush = () => new Promise((resolve) => setImmediate(resolve));

function mockReq(
  overrides: Partial<{
    method: string;
    headers: Record<string, string | string[]>;
    body: any;
    socket: any;
  }> = {},
) {
  return {
    method: overrides.method ?? 'POST',
    headers: overrides.headers ?? {},
    body: overrides.body ?? {},
    socket: overrides.socket,
  } as any;
}

function mockRes(headersSent = false) {
  return Object.assign(new EventEmitter(), {
    writeHead: jest.fn(),
    end: jest.fn(),
    set: jest.fn(),
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
    headersSent,
  }) as any;
}

describe('McpHttpService session lifecycle', () => {
  const config: McpModuleConfig = {
    metadata: { name: 'test-server', version: '1.0.0' },
  };
  let registry: McpToolRegistry;
  let service: McpHttpService;
  let errorSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;

  async function openSession(sessionId: string) {
    await service.handleRequest(mockReq(), mockRes());
    capturedOnSessionInitialized!(sessionId);
  }

  const sessions = () => (service as any).sessions as Map<string, unknown>;

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnSessionInitialized = undefined;
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    registry = new McpToolRegistry();
    service = new McpHttpService(config as any, registry);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('server construction', () => {
    it('should pass description, instructions and serverOptions to each McpServer', async () => {
      await service.onModuleDestroy();
      service = new McpHttpService(
        {
          metadata: {
            name: 'srv',
            version: '2.0.0',
            description: 'Described',
            instructions: 'Be nice',
          },
          serverOptions: { capabilities: { experimental: {} } },
        } as any,
        registry,
      );

      await service.handleRequest(mockReq(), mockRes());

      const [info, options] = (McpServer as unknown as jest.Mock).mock.calls[0];
      expect(info).toEqual({
        name: 'srv',
        version: '2.0.0',
        description: 'Described',
      });
      expect(options.instructions).toBe('Be nice');
      expect(options.capabilities).toEqual({ logging: {} });
    });

    it('should omit description and instructions when not configured', async () => {
      await service.handleRequest(mockReq(), mockRes());

      const [info, options] = (McpServer as unknown as jest.Mock).mock.calls[0];
      expect(info).toEqual({ name: 'test-server', version: '1.0.0' });
      expect(options).not.toHaveProperty('instructions');
    });
  });

  describe('DELETE', () => {
    it('should forward DELETE to the transport, then remove and close the session', async () => {
      await openSession('del-ok');
      mockTransportHandleRequest.mockClear();

      const req = mockReq({
        method: 'DELETE',
        headers: { 'mcp-session-id': 'del-ok' },
      });
      const res = mockRes();
      await service.handleRequest(req, res);

      expect(mockTransportHandleRequest).toHaveBeenCalledWith(req, res, {});
      expect(res.writeHead).not.toHaveBeenCalled();
      expect(sessions().has('del-ok')).toBe(false);
      expect(mockTransportClose).toHaveBeenCalledTimes(1);
      expect(mockServerClose).toHaveBeenCalledTimes(1);
      expect(logSpy).toHaveBeenCalledWith('Session closed: del-ok');
    });
  });

  describe('error handling', () => {
    it('should not write a 500 response when headers were already sent', async () => {
      await openSession('sent');
      mockTransportHandleRequest.mockRejectedValueOnce(new Error('mid-stream'));

      const res = mockRes(true);
      await service.handleRequest(
        mockReq({ method: 'GET', headers: { 'mcp-session-id': 'sent' } }),
        res,
      );

      expect(errorSpy).toHaveBeenCalledWith(
        'MCP request handling error:',
        expect.any(Error),
      );
      expect(res.writeHead).not.toHaveBeenCalled();
      expect(res.end).not.toHaveBeenCalled();
    });

    it('should log transport and server close errors for unstored per-request sessions', async () => {
      const transportError = new Error('transport close failed');
      const serverError = new Error('server close failed');
      mockTransportClose.mockRejectedValueOnce(transportError);
      mockServerClose.mockRejectedValueOnce(serverError);

      const res = mockRes();
      await service.handleRequest(mockReq(), res);
      res.emit('close');
      await flush();

      expect(errorSpy).toHaveBeenCalledWith(
        'Error closing transport:',
        transportError,
      );
      expect(errorSpy).toHaveBeenCalledWith(
        'Error closing server:',
        serverError,
      );
    });

    it('should log server close errors when closing a stored session', async () => {
      await openSession('bad-server');
      const serverError = new Error('server close failed');
      mockServerClose.mockRejectedValueOnce(serverError);

      await service.onModuleDestroy();

      expect(errorSpy).toHaveBeenCalledWith(
        'Error closing server for session bad-server:',
        serverError,
      );
      expect(sessions().size).toBe(0);
    });
  });

  describe('idle session sweeping', () => {
    beforeEach(async () => {
      await service.onModuleDestroy();
      jest.useFakeTimers();
      service = new McpHttpService(
        { ...config, session: { ttlMinutes: 1 } } as any,
        registry,
      );
    });

    it('should evict sessions idle longer than the TTL and keep active ones', async () => {
      await openSession('idle');
      await openSession('busy');

      // Keep "busy" active just before the second sweep.
      jest.advanceTimersByTime(90_000);
      await service.handleRequest(
        mockReq({ method: 'GET', headers: { 'mcp-session-id': 'busy' } }),
        mockRes(),
      );

      jest.advanceTimersByTime(30_000);
      await Promise.resolve();

      expect(sessions().has('idle')).toBe(false);
      expect(sessions().has('busy')).toBe(true);
      expect(logSpy).toHaveBeenCalledWith('Evicting idle session: idle');
      expect(mockTransportClose).toHaveBeenCalledTimes(1);
    });

    it('should not evict sessions before the TTL has elapsed', async () => {
      await openSession('fresh');

      jest.advanceTimersByTime(60_000);

      expect(sessions().has('fresh')).toBe(true);
      expect(mockTransportClose).not.toHaveBeenCalled();
    });

    it('should stop sweeping after onModuleDestroy', async () => {
      await service.onModuleDestroy();
      const sweep = jest.spyOn(service as any, 'sweepStaleSessions');

      jest.advanceTimersByTime(5 * 60_000);

      expect(sweep).not.toHaveBeenCalled();
    });
  });

  describe('resource metadata URL derivation', () => {
    const verifier: OAuthTokenVerifier = { verifyAccessToken: jest.fn() };

    async function wwwAuthenticate(req: any) {
      service.setBearerAuthVerifier(verifier);
      const res = mockRes();
      await service.handleRequest(req, res);
      const call = res.set.mock.calls.find(
        ([name]: [string]) => name === 'WWW-Authenticate',
      );
      return call?.[1] as string;
    }

    it('should honour x-forwarded-proto and x-forwarded-host headers', async () => {
      const header = await wwwAuthenticate(
        mockReq({
          headers: {
            host: 'internal:3000',
            'x-forwarded-proto': 'https',
            'x-forwarded-host': 'public.example.com',
          },
        }),
      );

      expect(header).toContain(
        'resource_metadata="https://public.example.com/.well-known/oauth-protected-resource/mcp"',
      );
    });

    it('should use the first value of array-valued forwarded headers', async () => {
      const header = await wwwAuthenticate(
        mockReq({
          headers: {
            'x-forwarded-proto': ['https', 'http'],
            'x-forwarded-host': ['first.example.com', 'second.example.com'],
          },
        }),
      );

      expect(header).toContain('https://first.example.com/.well-known/');
    });

    it('should infer https from an encrypted socket', async () => {
      const header = await wwwAuthenticate(
        mockReq({
          headers: { host: 'secure.example.com' },
          socket: { encrypted: true },
        }),
      );

      expect(header).toContain('https://secure.example.com/.well-known/');
    });

    it('should omit resource_metadata when no host can be determined', async () => {
      const header = await wwwAuthenticate(mockReq({ headers: {} }));

      expect(header).toBeDefined();
      expect(header).not.toContain('resource_metadata');
    });

    it('should omit resource_metadata for a root-relative configured URL without a host', async () => {
      service.setBearerAuthVerifier(verifier, {
        resourceMetadataUrl: '/.well-known/custom',
      });
      const res = mockRes();
      await service.handleRequest(mockReq({ headers: {} }), res);

      const call = res.set.mock.calls.find(
        ([name]: [string]) => name === 'WWW-Authenticate',
      );
      expect(call[1]).not.toContain('resource_metadata');
    });

    it('should skip bearer authentication for OPTIONS requests', async () => {
      service.setBearerAuthVerifier(verifier);
      const res = mockRes();

      await service.handleRequest(
        mockReq({ method: 'OPTIONS', headers: { 'mcp-session-id': 'x' } }),
        res,
      );

      expect(res.status).not.toHaveBeenCalledWith(401);
      // Proceeds to session lookup, which fails for an unknown session.
      expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    });
  });
});
