import { Injectable, Logger, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PassThrough } from 'node:stream';
import { McpStdioModule } from './mcp-stdio.module';
import { McpToolRegistry } from './mcp-tool-registry';
import { MCP_STDIO_CONFIG } from './mcp-stdio-config-token';
import { McpTool } from './mcp-tool.decorator';
import { McpGuard } from './mcp-guard.decorator';
import { McpScopeGuard } from './mcp-scope-guard';

const mockServerConnect = jest.fn().mockResolvedValue(undefined);
const mockServerClose = jest.fn().mockResolvedValue(undefined);
const mockTransportClose = jest.fn().mockResolvedValue(undefined);

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn().mockReturnValue({
      enable: jest.fn(),
      disable: jest.fn(),
    }),
    registerResource: jest.fn(),
    registerPrompt: jest.fn(),
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

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({
    close: mockTransportClose,
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

class ResolvableProvider {}

const STDIO_NAME = Symbol('STDIO_NAME');

@Module({
  providers: [{ provide: STDIO_NAME, useValue: 'from-config-module' }],
  exports: [STDIO_NAME],
})
class ConfigModule {}

describe('McpStdioModule (async registration and lifecycle)', () => {
  let module: TestingModule | undefined;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await module?.close();
    module = undefined;
    jest.restoreAllMocks();
  });

  describe('registerAndServeStdioAsync', () => {
    it('should resolve config from an injected factory and start the server', async () => {
      const stdin = new PassThrough();
      const stdout = new PassThrough();
      const useFactory = jest.fn(async (name: string) => ({
        metadata: { name, version: '3.0.0' },
        stdin,
        stdout,
      }));

      module = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdioAsync({
            imports: [ConfigModule],
            inject: [STDIO_NAME],
            useFactory,
          }),
        ],
        providers: [EchoService],
      }).compile();
      await module.init();

      expect(useFactory).toHaveBeenCalledWith('from-config-module');
      expect(module.get(MCP_STDIO_CONFIG).metadata.name).toBe(
        'from-config-module',
      );
      expect(McpServer).toHaveBeenCalledWith(
        { name: 'from-config-module', version: '3.0.0' },
        expect.objectContaining({ capabilities: expect.any(Object) }),
      );
      expect(StdioServerTransport).toHaveBeenCalledWith(stdin, stdout);
      expect(mockServerConnect).toHaveBeenCalledTimes(1);
      expect(module.get(McpToolRegistry).hasTool('echo')).toBe(true);
    });

    it('should default imports and inject when omitted', async () => {
      const dyn = McpStdioModule.registerAndServeStdioAsync({
        useFactory: () => ({ metadata: { name: 'n', version: '1' } }),
      });
      expect(dyn.imports).toHaveLength(1);
      const configProvider = (dyn.providers as any[]).find(
        (p) => p?.provide === MCP_STDIO_CONFIG,
      );
      expect(configProvider.inject).toEqual([]);

      module = await Test.createTestingModule({ imports: [dyn] }).compile();
      await module.init();
      expect(mockServerConnect).toHaveBeenCalled();
    });
  });

  describe('server construction', () => {
    it('should pass description, instructions and serverOptions to McpServer', async () => {
      module = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: {
              name: 'srv',
              version: '1.0.0',
              description: 'A server',
              instructions: 'Use the tools wisely',
            },
            serverOptions: { capabilities: { experimental: {} } } as any,
          }),
        ],
      }).compile();
      await module.init();

      const [info, options] = (McpServer as unknown as jest.Mock).mock.calls[0];
      expect(info).toEqual({
        name: 'srv',
        version: '1.0.0',
        description: 'A server',
      });
      expect(options.instructions).toBe('Use the tools wisely');
      // Computed capabilities replace any provided in serverOptions.
      expect(options.capabilities).toEqual({ logging: {} });
    });

    it('should omit description and instructions when not configured', async () => {
      module = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'srv', version: '1.0.0' },
          }),
        ],
      }).compile();
      await module.init();

      const [info, options] = (McpServer as unknown as jest.Mock).mock.calls[0];
      expect(info).toEqual({ name: 'srv', version: '1.0.0' });
      expect(options).not.toHaveProperty('instructions');
    });

    it('should resolve @McpGuard classes through DI when executing tools', async () => {
      module = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'srv', version: '1.0.0' },
          }),
        ],
        providers: [EchoService],
      }).compile();
      await module.init();
      const registry = module.get(McpToolRegistry);

      await expect(registry.executeToolRaw('admin', {})).rejects.toThrow(
        /Access denied by McpScopeGuard/,
      );
      await expect(
        registry.executeToolRaw(
          'admin',
          {},
          {
            token: 't',
            clientId: 'c',
            scopes: ['admin'],
          },
        ),
      ).resolves.toBe('admin ok');
    });

    it('should install a provider resolver backed by DI', async () => {
      module = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'srv', version: '1.0.0' },
          }),
        ],
        providers: [ResolvableProvider],
      }).compile();
      await module.init();

      expect(
        module.get(McpToolRegistry).resolveProvider(ResolvableProvider),
      ).toBe(module.get(ResolvableProvider));
    });
  });

  describe('onModuleDestroy', () => {
    async function initModule() {
      module = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'srv', version: '1.0.0' },
          }),
        ],
        providers: [EchoService],
      }).compile();
      await module.init();
      return module.get(McpToolRegistry);
    }

    it('should unwire the registry so later registrations are not forwarded', async () => {
      const registry = await initModule();
      const server = (McpServer as unknown as jest.Mock).mock.results[0].value;

      await module!.close();
      module = undefined;
      server.registerTool.mockClear();

      registry.registerTool({ name: 'late', description: 'd' }, jest.fn());
      expect(server.registerTool).not.toHaveBeenCalled();
    });

    it('should still close the server when closing the transport fails', async () => {
      await initModule();
      const failure = new Error('transport close failed');
      mockTransportClose.mockRejectedValueOnce(failure);

      await module!.close();
      module = undefined;

      expect(errorSpy).toHaveBeenCalledWith(
        'Error closing stdio transport:',
        failure,
      );
      expect(mockServerClose).toHaveBeenCalledTimes(1);
    });

    it('should log when closing the server fails', async () => {
      await initModule();
      const failure = new Error('server close failed');
      mockServerClose.mockRejectedValueOnce(failure);

      await module!.close();
      module = undefined;

      expect(mockTransportClose).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        'Error closing MCP server:',
        failure,
      );
    });

    it('should be safe to destroy before init', async () => {
      const instance = new McpStdioModule(
        { metadata: { name: 'x', version: '1' } },
        {} as any,
        {} as any,
        new McpToolRegistry(),
        {} as any,
      );

      await expect(instance.onModuleDestroy()).resolves.toBeUndefined();
      expect(mockTransportClose).not.toHaveBeenCalled();
      expect(mockServerClose).not.toHaveBeenCalled();
    });
  });
});
