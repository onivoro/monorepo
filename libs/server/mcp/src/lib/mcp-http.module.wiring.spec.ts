import { Injectable, Logger, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { McpHttpModule } from './mcp-http.module';
import { McpHttpService } from './mcp-http.service';
import { McpToolRegistry } from './mcp-tool-registry';
import { MCP_MODULE_CONFIG } from './mcp-module-config-token';
import { McpTool } from './mcp-tool.decorator';
import { McpGuard } from './mcp-guard.decorator';
import { McpScopeGuard } from './mcp-scope-guard';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpAuthStrategy } from './mcp-auth-strategy';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn(),
    registerResource: jest.fn(),
    registerPrompt: jest.fn(),
    connect: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
  ResourceTemplate: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation(() => ({
    handleRequest: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

@Injectable()
class EchoService {
  @McpTool({ name: 'echo', description: 'Echo' })
  async echo() {
    return 'echo';
  }

  @McpTool({ name: 'admin', description: 'Admin only' })
  @McpGuard(McpScopeGuard, { scopes: ['admin'] })
  async admin() {
    return 'admin ok';
  }
}

@Injectable()
class PlainAuthStrategy implements McpAuthStrategy {
  resolveAuth(authInfo: McpAuthInfo | undefined) {
    return authInfo;
  }
}

@Injectable()
class VerifierAuthStrategy extends PlainAuthStrategy {
  async verifyAccessToken(token: string) {
    return { token, clientId: 'client', scopes: [] };
  }
}

@Module({
  providers: [PlainAuthStrategy, VerifierAuthStrategy],
  exports: [PlainAuthStrategy, VerifierAuthStrategy],
})
class AuthModule {}

function mockReq(method: string, body?: unknown) {
  return { method, headers: {}, ...(body !== undefined && { body }) } as any;
}

function mockRes() {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('McpHttpModule wiring', () => {
  let module: TestingModule | undefined;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await module?.close();
    module = undefined;
    jest.restoreAllMocks();
  });

  describe('controller dispatch', () => {
    let controller: any;
    let service: McpHttpService;

    beforeEach(async () => {
      const dynamicModule = McpHttpModule.registerAndServeHttp({
        metadata: { name: 'test', version: '1.0.0' },
      });
      module = await Test.createTestingModule({
        imports: [dynamicModule],
      }).compile();
      await module.init();

      controller = module.get(dynamicModule.controllers![0]);
      service = module.get(McpHttpService);
      jest.spyOn(service, 'handleRequest').mockResolvedValue(undefined);
    });

    it.each([
      ['handleMcpGet', 'GET', undefined],
      ['handleMcpDelete', 'DELETE', undefined],
      ['handleMcpOptions', 'OPTIONS', undefined],
      ['handleMcpPost', 'POST', { jsonrpc: '2.0', method: 'ping', id: 1 }],
    ])(
      '%s should delegate %s requests to McpHttpService',
      async (handler, method, body) => {
        const req = mockReq(method, body);
        const res = mockRes();

        await controller[handler](req, res);

        expect(service.handleRequest).toHaveBeenCalledWith(req, res);
        expect(res.status).not.toHaveBeenCalled();
      },
    );

    it('should reject POST requests whose body was not parsed', async () => {
      const req = mockReq('POST');
      const res = mockRes();

      await controller.handleMcpPost(req, res);

      expect(service.handleRequest).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: expect.stringContaining('Request body not parsed'),
        },
        id: null,
      });
    });
  });

  describe('guard resolution', () => {
    it('should resolve @McpGuard classes through DI when executing tools', async () => {
      module = await Test.createTestingModule({
        imports: [
          McpHttpModule.registerAndServeHttp({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
        providers: [EchoService],
      }).compile();
      await module.init();
      const registry = module.get(McpToolRegistry);
      const auth = (scopes: string[]) => ({
        token: 't',
        clientId: 'c',
        scopes,
      });

      await expect(
        registry.executeToolRaw('admin', {}, auth(['user'])),
      ).rejects.toThrow('Access denied by McpScopeGuard for tool "admin".');
      await expect(
        registry.executeToolRaw('admin', {}, auth(['admin'])),
      ).resolves.toBe('admin ok');
    });

    it('should resolve arbitrary providers through DI', async () => {
      module = await Test.createTestingModule({
        imports: [
          McpHttpModule.registerAndServeHttp({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
        providers: [EchoService],
      }).compile();
      await module.init();

      expect(module.get(McpToolRegistry).resolveProvider(EchoService)).toBe(
        module.get(EchoService),
      );
    });
  });

  describe('registerAndServeHttp', () => {
    it('should store the normalized route in the provided config', async () => {
      module = await Test.createTestingModule({
        imports: [
          McpHttpModule.registerAndServeHttp({
            metadata: { name: 'test', version: '1.0.0' },
            route: '/api/mcp/',
          }),
        ],
      }).compile();

      expect(module.get(MCP_MODULE_CONFIG)).toEqual({
        metadata: { name: 'test', version: '1.0.0' },
        route: 'api/mcp',
      });
    });

    it('should throw synchronously for an invalid route', () => {
      expect(() =>
        McpHttpModule.registerAndServeHttp({
          metadata: { name: 'test', version: '1.0.0' },
          route: 'a/../b',
        }),
      ).toThrow(/segments/);
    });
  });

  describe('registerAndServeHttpAsync', () => {
    const CONFIG_VALUE = Symbol('CONFIG_VALUE');

    @Module({
      providers: [{ provide: CONFIG_VALUE, useValue: 'async-server' }],
      exports: [CONFIG_VALUE],
    })
    class ConfigModule {}

    it('should build config from an injected factory and add the normalized route', async () => {
      const useFactory = jest.fn(async (name: string) => ({
        metadata: { name, version: '2.0.0' },
      }));

      module = await Test.createTestingModule({
        imports: [
          McpHttpModule.registerAndServeHttpAsync({
            imports: [ConfigModule],
            inject: [CONFIG_VALUE],
            useFactory,
            route: '/custom/',
          }),
        ],
        providers: [EchoService],
      }).compile();
      await module.init();

      expect(useFactory).toHaveBeenCalledWith('async-server');
      expect(module.get(MCP_MODULE_CONFIG)).toEqual({
        metadata: { name: 'async-server', version: '2.0.0' },
        route: 'custom',
      });
      expect(module.get(McpToolRegistry).hasTool('echo')).toBe(true);
    });

    it('should default route, imports and inject when omitted', async () => {
      const dyn = McpHttpModule.registerAndServeHttpAsync({
        useFactory: () => ({ metadata: { name: 'sync', version: '1.0.0' } }),
      });
      expect(dyn.imports).toHaveLength(1);

      module = await Test.createTestingModule({ imports: [dyn] }).compile();

      expect(module.get(MCP_MODULE_CONFIG)).toEqual({
        metadata: { name: 'sync', version: '1.0.0' },
        route: 'mcp',
      });
    });

    it('should ignore a route returned by the factory in favour of options.route', async () => {
      module = await Test.createTestingModule({
        imports: [
          McpHttpModule.registerAndServeHttpAsync({
            route: 'outer',
            useFactory: () =>
              ({
                metadata: { name: 'x', version: '1' },
                route: 'inner',
              }) as any,
          }),
        ],
      }).compile();

      expect(module.get(MCP_MODULE_CONFIG).route).toBe('outer');
    });
  });

  describe('requireBearerAuth', () => {
    async function init(config: Record<string, unknown>) {
      module = await Test.createTestingModule({
        imports: [
          AuthModule,
          McpHttpModule.registerAndServeHttp({
            metadata: { name: 'test', version: '1.0.0' },
            ...config,
          }),
        ],
      }).compile();
      const service = module.get(McpHttpService);
      const spy = jest.spyOn(service, 'setBearerAuthVerifier');
      await module.init();
      return spy;
    }

    it('should throw when the authStrategy does not implement verifyAccessToken', async () => {
      await expect(
        init({ authStrategy: PlainAuthStrategy, requireBearerAuth: true }),
      ).rejects.toThrow(
        'authStrategy PlainAuthStrategy does not implement OAuthTokenVerifier',
      );

      // A failed init makes close() rethrow, so stop the service's sweep timer directly.
      await module!.get(McpHttpService).onModuleDestroy();
      module = undefined;
    });

    it('should configure the verifier with empty scopes when requireBearerAuth is true', async () => {
      const spy = await init({
        authStrategy: VerifierAuthStrategy,
        requireBearerAuth: true,
      });

      expect(spy).toHaveBeenCalledWith(module!.get(VerifierAuthStrategy), {
        requiredScopes: [],
        resourceMetadataUrl: undefined,
      });
    });

    it('should forward requiredScopes and a root-relative resourceMetadataUrl', async () => {
      const spy = await init({
        authStrategy: VerifierAuthStrategy,
        requireBearerAuth: {
          requiredScopes: ['mcp:read'],
          resourceMetadataUrl: '/.well-known/oauth-protected-resource',
        },
      });

      expect(spy).toHaveBeenCalledWith(expect.anything(), {
        requiredScopes: ['mcp:read'],
        resourceMetadataUrl: '/.well-known/oauth-protected-resource',
      });
    });

    it('should accept an absolute resourceMetadataUrl and default requiredScopes', async () => {
      const spy = await init({
        authStrategy: VerifierAuthStrategy,
        requireBearerAuth: {
          resourceMetadataUrl: 'https://example.test/.well-known/x',
        },
      });

      expect(spy).toHaveBeenCalledWith(expect.anything(), {
        requiredScopes: [],
        resourceMetadataUrl: 'https://example.test/.well-known/x',
      });
    });

    it('should not configure bearer auth when requireBearerAuth is not set', async () => {
      const spy = await init({ authStrategy: PlainAuthStrategy });
      expect(spy).not.toHaveBeenCalled();
    });

    it('should not configure bearer auth without an authStrategy', async () => {
      const spy = await init({ requireBearerAuth: true });
      expect(spy).not.toHaveBeenCalled();
    });
  });
});
