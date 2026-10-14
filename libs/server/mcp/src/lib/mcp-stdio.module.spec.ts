import { Injectable, Module } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  serveStdio,
  StdioServerTransport,
} from '@modelcontextprotocol/server/stdio';
import { McpStdioModule } from './mcp-stdio.module';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpAuthStrategy } from './mcp-auth-strategy';
import { McpTool } from './mcp-tool.decorator';
import { McpResource } from './mcp-resource.decorator';
import { McpPrompt } from './mcp-prompt.decorator';
import { z } from 'zod';
import { PassThrough } from 'node:stream';

const mockServerRegisterTool = jest.fn();
const mockServerRegisterResource = jest.fn();
const mockServerRegisterPrompt = jest.fn();
const mockServerConnect = jest.fn().mockResolvedValue(undefined);
const mockServerClose = jest.fn().mockResolvedValue(undefined);
const mockTransportClose = jest.fn().mockResolvedValue(undefined);

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

jest.mock('@modelcontextprotocol/server/stdio', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({
    close: mockTransportClose,
  })),
  // Builds the server at once, as the client's first message would, and closes the
  // transport and the server on close, like the SDK's handle.
  // The factory may return a promise, which the SDK awaits.
  serveStdio: jest.fn().mockImplementation((factory: any, options: any) => {
    const server = Promise.resolve(factory({ era: 'legacy' }));
    return {
      close: async () => {
        try {
          await options.transport.close();
        } finally {
          await (await server).close();
        }
      },
    };
  }),
}));

const testToolSchema = z.object({
  input: z.string().describe('test input'),
});

@Injectable()
class TestToolService {
  @McpTool({
    name: 'test-tool',
    description: 'A test tool',
    schema: testToolSchema,
  })
  async myTool(params: z.infer<typeof testToolSchema>) {
    return { content: [{ type: 'text', text: `echo: ${params.input}` }] };
  }
}

@Injectable()
class TestResourceService {
  @McpResource({
    name: 'test-resource',
    uri: 'test://data',
    description: 'Test resource',
  })
  async myResource() {
    return { contents: [{ uri: 'test://data', text: 'resource data' }] };
  }
}

@Injectable()
class TestPromptService {
  @McpPrompt({ name: 'test-prompt', description: 'A test prompt' })
  async myPrompt() {
    return {
      messages: [{ role: 'user', content: { type: 'text', text: 'hello' } }],
    };
  }
}

describe('McpStdioModule', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compile the module with configure()', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpStdioModule.registerAndServeStdio({
          metadata: { name: 'test-stdio', version: '1.0.0' },
          stdin: new PassThrough(),
          stdout: new PassThrough(),
        }),
      ],
    }).compile();

    const registry = module.get(McpToolRegistry);
    expect(registry).toBeDefined();

    await module.close();
  });

  it('should discover and register tools on init', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpStdioModule.registerAndServeStdio({
          metadata: { name: 'test-stdio', version: '1.0.0' },
          stdin: new PassThrough(),
          stdout: new PassThrough(),
        }),
      ],
      providers: [TestToolService],
    }).compile();

    await module.init();

    const registry = module.get(McpToolRegistry);
    const tools = registry.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].metadata.name).toBe('test-tool');

    expect(mockServerRegisterTool).toHaveBeenCalledWith(
      'test-tool',
      expect.objectContaining({ description: 'A test tool' }),
      expect.any(Function),
    );

    expect(serveStdio).toHaveBeenCalled();

    await module.close();
  });

  it('should discover and register resources on init', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpStdioModule.registerAndServeStdio({
          metadata: { name: 'test-stdio', version: '1.0.0' },
          stdin: new PassThrough(),
          stdout: new PassThrough(),
        }),
      ],
      providers: [TestResourceService],
    }).compile();

    await module.init();

    const registry = module.get(McpToolRegistry);
    const resources = registry.getResources();
    expect(resources).toHaveLength(1);
    expect(resources[0].metadata.name).toBe('test-resource');

    expect(mockServerRegisterResource).toHaveBeenCalled();

    await module.close();
  });

  it('should discover and register prompts on init', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpStdioModule.registerAndServeStdio({
          metadata: { name: 'test-stdio', version: '1.0.0' },
          stdin: new PassThrough(),
          stdout: new PassThrough(),
        }),
      ],
      providers: [TestPromptService],
    }).compile();

    await module.init();

    const registry = module.get(McpToolRegistry);
    const prompts = registry.getPrompts();
    expect(prompts).toHaveLength(1);
    expect(prompts[0].metadata.name).toBe('test-prompt');

    expect(mockServerRegisterPrompt).toHaveBeenCalled();

    await module.close();
  });

  it('should create McpServer with correct metadata', async () => {
    const { McpServer } = require('@modelcontextprotocol/server');

    const module = await Test.createTestingModule({
      imports: [
        McpStdioModule.registerAndServeStdio({
          metadata: { name: 'my-stdio-server', version: '2.0.0' },
          stdin: new PassThrough(),
          stdout: new PassThrough(),
        }),
      ],
      providers: [TestToolService],
    }).compile();

    await module.init();

    expect(McpServer).toHaveBeenCalledWith(
      { name: 'my-stdio-server', version: '2.0.0' },
      expect.objectContaining({
        capabilities: { logging: {}, tools: { listChanged: true } },
      }),
    );

    await module.close();
  });

  it('should create StdioServerTransport with custom streams', async () => {
    const {
      StdioServerTransport,
    } = require('@modelcontextprotocol/server/stdio');
    const stdin = new PassThrough();
    const stdout = new PassThrough();

    const module = await Test.createTestingModule({
      imports: [
        McpStdioModule.registerAndServeStdio({
          metadata: { name: 'test-stdio', version: '1.0.0' },
          stdin,
          stdout,
        }),
      ],
    }).compile();

    await module.init();

    expect(StdioServerTransport).toHaveBeenCalledWith(stdin, stdout);

    await module.close();
  });

  it('should close transport and server on module destroy', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpStdioModule.registerAndServeStdio({
          metadata: { name: 'test-stdio', version: '1.0.0' },
          stdin: new PassThrough(),
          stdout: new PassThrough(),
        }),
      ],
    }).compile();

    await module.init();
    await module.close();

    expect(mockTransportClose).toHaveBeenCalled();
    expect(mockServerClose).toHaveBeenCalled();
  });

  describe('auth strategy wiring', () => {
    const resolveAuthSpy = jest.fn();
    const authDependency = { mark: 'from-auth-module' };

    @Injectable()
    class TestAuthDependency {
      readonly mark = authDependency.mark;
    }

    @Injectable()
    class TestAuthStrategy implements McpAuthStrategy {
      constructor(private readonly dependency: TestAuthDependency) {}

      resolveAuth(authInfo: McpAuthInfo | undefined) {
        resolveAuthSpy(authInfo);
        return authInfo
          ? {
              ...authInfo,
              extra: { enriched: true, dependency: this.dependency.mark },
            }
          : undefined;
      }
    }

    @Module({
      providers: [TestAuthDependency, TestAuthStrategy],
      exports: [TestAuthStrategy],
    })
    class TestAuthModule {}

    beforeEach(() => resolveAuthSpy.mockClear());

    it('should resolve authStrategy class through DI and wire to registry', async () => {
      const module = await Test.createTestingModule({
        imports: [
          TestAuthModule,
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'test-stdio', version: '1.0.0' },
            stdin: new PassThrough(),
            stdout: new PassThrough(),
            authStrategy: TestAuthStrategy,
          }),
        ],
      }).compile();

      await module.init();

      const registry = module.get(McpToolRegistry);
      let handlerAuth: any;
      registry.registerTool(
        { name: 'auth-test', description: 'd' },
        jest.fn().mockImplementation((_p: any, ctx: any) => {
          handlerAuth = ctx.authInfo;
          return 'ok';
        }),
      );

      const mockAuth = { token: 'test', clientId: 'c', scopes: [] };
      await registry.executeToolRaw('auth-test', {}, mockAuth);
      expect(resolveAuthSpy).toHaveBeenCalledWith(mockAuth);
      expect(handlerAuth.extra).toEqual({
        enriched: true,
        dependency: authDependency.mark,
      });

      await module.close();
    });

    it('should not set authStrategy when not in config', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'test-stdio', version: '1.0.0' },
            stdin: new PassThrough(),
            stdout: new PassThrough(),
          }),
        ],
      }).compile();

      await module.init();

      const registry = module.get(McpToolRegistry);
      let handlerAuth: any;
      registry.registerTool(
        { name: 'auth-test', description: 'd' },
        jest.fn().mockImplementation((_p: any, ctx: any) => {
          handlerAuth = ctx.authInfo;
          return 'ok';
        }),
      );

      const mockAuth = { token: 'test', clientId: 'c', scopes: [] };
      await registry.executeToolRaw('auth-test', {}, mockAuth);
      expect(handlerAuth).toBe(mockAuth);

      await module.close();
    });
  });

  it('should handle errors during destroy gracefully', async () => {
    mockTransportClose.mockRejectedValueOnce(new Error('close failed'));

    const module = await Test.createTestingModule({
      imports: [
        McpStdioModule.registerAndServeStdio({
          metadata: { name: 'test-stdio', version: '1.0.0' },
          stdin: new PassThrough(),
          stdout: new PassThrough(),
        }),
      ],
    }).compile();

    await module.init();

    // Should not throw despite transport close failure
    await expect(module.close()).resolves.not.toThrow();

    expect(mockServerClose).toHaveBeenCalled();
  });
});
