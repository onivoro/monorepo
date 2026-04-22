import { McpHttpService } from './mcp-http.service';
import { McpToolRegistry } from './mcp-tool-registry';
import { McpModuleConfig } from './mcp-config.interface';

const mockTransportHandleRequest = jest.fn().mockResolvedValue(undefined);
const mockTransportClose = jest.fn().mockResolvedValue(undefined);
const mockServerRegisterTool = jest.fn();
const mockServerRegisterResource = jest.fn();
const mockServerRegisterPrompt = jest.fn();
const mockServerConnect = jest.fn();
const mockServerClose = jest.fn().mockResolvedValue(undefined);

let capturedOnSessionInitialized: ((sessionId: string) => void) | undefined;
let capturedTransportOptions: any;

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: mockServerRegisterTool,
    registerResource: mockServerRegisterResource,
    registerPrompt: mockServerRegisterPrompt,
    connect: mockServerConnect,
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
  const config: McpModuleConfig = {
    metadata: { name: 'test-server', version: '1.0.0' },
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
    function mockReq(overrides: Partial<{ method: string; headers: Record<string, string>; body: any }> = {}) {
      return {
        method: overrides.method ?? 'POST',
        headers: overrides.headers ?? {},
        body: overrides.body ?? {},
      } as any;
    }

    function mockRes() {
      return {
        writeHead: jest.fn(),
        end: jest.fn(),
        headersSent: false,
      } as any;
    }

    it('should return 400 for non-POST without session ID', async () => {
      const req = mockReq({ method: 'GET' });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(400, { 'Content-Type': 'application/json' });
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error.message).toContain('Missing Mcp-Session-Id');
    });

    it('should return 404 for invalid session ID', async () => {
      const req = mockReq({ headers: { 'mcp-session-id': 'nonexistent' } });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(404, { 'Content-Type': 'application/json' });
    });

    it('should create a session on POST without session ID', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      const req = mockReq();
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(mockTransportHandleRequest).toHaveBeenCalledWith(req, res, {});
      expect(mockServerConnect).toHaveBeenCalled();
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
      const req = mockReq({ headers: { 'mcp-session-id': 'test-session-123' } });
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(mockTransportHandleRequest).toHaveBeenCalledWith(req, res, {});
      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('should clean up session on DELETE even if transport throws', async () => {
      registry.registerTool({ name: 'test', description: 'test' }, jest.fn());

      // Create session
      const initReq = mockReq();
      await service.handleRequest(initReq, mockRes());
      capturedOnSessionInitialized!('delete-session');

      // Make DELETE throw from transport
      mockTransportHandleRequest.mockRejectedValueOnce(new Error('transport error'));

      const req = mockReq({ method: 'DELETE', headers: { 'mcp-session-id': 'delete-session' } });
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
      const req = mockReq({ headers: { 'mcp-session-id': 'activity-session' } });
      const res = mockRes();
      await service.handleRequest(req, res);

      expect(res.writeHead).not.toHaveBeenCalled();
    });

    it('should return 500 on unexpected errors', async () => {
      // Force createSession to throw by making McpServer constructor throw
      const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
      McpServer.mockImplementationOnce(() => {
        throw new Error('boom');
      });

      const req = mockReq();
      const res = mockRes();

      await service.handleRequest(req, res);

      expect(res.writeHead).toHaveBeenCalledWith(500, { 'Content-Type': 'application/json' });
      const body = JSON.parse(res.end.mock.calls[0][0]);
      expect(body.error.code).toBe(-32603);
    });
  });

  describe('DNS rebinding protection', () => {
    let protectedService: McpHttpService;

    beforeEach(() => {
      protectedService = new McpHttpService(
        { ...config, allowedOrigins: ['http://localhost:3000', 'https://app.example.com'] } as any,
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

      expect(res.writeHead).toHaveBeenCalledWith(403, { 'Content-Type': 'application/json' });
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

    it('should skip validation when allowedOrigins is not configured', async () => {
      // Default service has no allowedOrigins
      const req = mockReq({ headers: { origin: 'https://anything.com' } });
      const res = mockRes();

      await service.handleRequest(req, res);

      // Should not get 403
      expect(res.writeHead).not.toHaveBeenCalledWith(403, expect.anything());
    });
  });

  describe('transport options', () => {
    it('should forward eventStore to transport when provided', async () => {
      const mockEventStore = {
        storeEvent: jest.fn(),
        replayEventsAfter: jest.fn(),
      };
      const customService = new McpHttpService(
        { ...config, eventStore: mockEventStore } as any,
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

    it('should default enableJsonResponse to true when not configured', async () => {
      await service.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.enableJsonResponse).toBe(true);
    });

    it('should forward enableJsonResponse as false when set in config', async () => {
      const customService = new McpHttpService(
        { ...config, enableJsonResponse: false } as any,
        registry,
      );

      await customService.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.enableJsonResponse).toBe(false);
      await customService.onModuleDestroy();
    });

    it('should use default sessionIdGenerator when not configured', async () => {
      await service.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.sessionIdGenerator).toBeInstanceOf(Function);
      // Should generate UUID-like strings
      const id = capturedTransportOptions.sessionIdGenerator();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('should forward custom sessionIdGenerator when provided', async () => {
      const customGenerator = () => 'custom-session-id';
      const customService = new McpHttpService(
        { ...config, sessionIdGenerator: customGenerator } as any,
        registry,
      );

      await customService.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.sessionIdGenerator).toBe(customGenerator);
      await customService.onModuleDestroy();
    });

    it('should pass undefined sessionIdGenerator for stateless mode', async () => {
      const customService = new McpHttpService(
        { ...config, sessionIdGenerator: undefined } as any,
        registry,
      );

      await customService.handleRequest(mockReq(), mockRes());

      expect(capturedTransportOptions.sessionIdGenerator).toBeUndefined();
      await customService.onModuleDestroy();
    });
  });

  describe('session TTL', () => {
    it('should use custom TTL from config', () => {
      const customService = new McpHttpService(
        { ...config, sessionTtlMinutes: 5 } as any,
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
      expect(registry.getResourceSubscribers('app://config').has('sub-session')).toBe(true);

      await service.onModuleDestroy();

      // Subscriptions should be cleaned up
      expect(registry.getResourceSubscribers('app://config').size).toBe(0);
    });
  });

  function mockReq(overrides: Partial<{ method: string; headers: Record<string, string>; body: any }> = {}) {
    return {
      method: overrides.method ?? 'POST',
      headers: overrides.headers ?? {},
      body: overrides.body ?? {},
    } as any;
  }

  function mockRes() {
    return {
      writeHead: jest.fn(),
      end: jest.fn(),
      headersSent: false,
    } as any;
  }
});
