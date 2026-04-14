import { McpService } from './mcp.service';
import { McpModuleConfig } from './mcp-config.interface';

const mockTransportHandleRequest = jest.fn().mockResolvedValue(undefined);
const mockTransportClose = jest.fn().mockResolvedValue(undefined);
const mockServerRegisterTool = jest.fn();
const mockServerRegisterResource = jest.fn();
const mockServerRegisterPrompt = jest.fn();
const mockServerConnect = jest.fn();
const mockServerClose = jest.fn().mockResolvedValue(undefined);

let capturedOnSessionInitialized: ((sessionId: string) => void) | undefined;

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: mockServerRegisterTool,
    registerResource: mockServerRegisterResource,
    registerPrompt: mockServerRegisterPrompt,
    connect: mockServerConnect,
    close: mockServerClose,
  })),
  ResourceTemplate: jest.fn(),
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

describe('McpService', () => {
  let service: McpService;
  const config: McpModuleConfig = {
    metadata: { name: 'test-server', version: '1.0.0' },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    capturedOnSessionInitialized = undefined;
    service = new McpService(config);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('registerTool', () => {
    it('should register a tool successfully', () => {
      const handler = jest.fn();
      service.registerTool({ name: 'my-tool', description: 'A test tool' }, handler);

      // No throw = success
      expect(handler).not.toHaveBeenCalled();
    });

    it('should throw on duplicate tool name', () => {
      const handler = jest.fn();
      service.registerTool({ name: 'dup-tool', description: 'First' }, handler);

      expect(() =>
        service.registerTool({ name: 'dup-tool', description: 'Second' }, handler),
      ).toThrow(/already registered/);
    });
  });

  describe('registerResource', () => {
    it('should register a resource successfully', () => {
      const handler = jest.fn();
      service.registerResource({ name: 'my-resource', uri: 'test://resource' }, handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should throw on duplicate resource name', () => {
      const handler = jest.fn();
      service.registerResource({ name: 'dup-res', uri: 'test://a' }, handler);

      expect(() =>
        service.registerResource({ name: 'dup-res', uri: 'test://b' }, handler),
      ).toThrow(/already registered/);
    });
  });

  describe('registerPrompt', () => {
    it('should register a prompt successfully', () => {
      const handler = jest.fn();
      service.registerPrompt({ name: 'my-prompt' }, handler);

      expect(handler).not.toHaveBeenCalled();
    });

    it('should throw on duplicate prompt name', () => {
      const handler = jest.fn();
      service.registerPrompt({ name: 'dup-prompt' }, handler);

      expect(() =>
        service.registerPrompt({ name: 'dup-prompt' }, handler),
      ).toThrow(/already registered/);
    });
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
      service.registerTool({ name: 'test', description: 'test' }, jest.fn());

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
      service.registerTool({ name: 'test', description: 'test' }, jest.fn());

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
      service.registerTool({ name: 'test', description: 'test' }, jest.fn());

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
      service.registerTool({ name: 'test', description: 'test' }, jest.fn());

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

  describe('session TTL', () => {
    it('should use custom TTL from config', () => {
      const customService = new McpService({
        ...config,
        sessionTtlMinutes: 5,
      });

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
      service.registerTool({ name: 'test', description: 'test' }, jest.fn());

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
      service.registerTool({ name: 'test', description: 'test' }, jest.fn());

      await service.handleRequest(mockReq(), mockRes());
      capturedOnSessionInitialized!('error-session');

      mockTransportClose.mockRejectedValueOnce(new Error('close failed'));

      // Should not throw
      await expect(service.onModuleDestroy()).resolves.not.toThrow();
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
