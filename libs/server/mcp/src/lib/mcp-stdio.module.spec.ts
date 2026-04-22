import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { McpStdioModule } from './mcp-stdio.module';
import { McpToolRegistry } from './mcp-tool-registry';
import type { McpAuthInfo } from './mcp-auth-info';
import type { McpAuthProvider } from './mcp-auth-provider';
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

jest.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: jest.fn().mockImplementation(() => ({
    close: mockTransportClose,
  })),
}));

const testToolSchema = z.object({
  input: z.string().describe('test input'),
});

@Injectable()
class TestToolService {
  @McpTool('test-tool', 'A test tool', testToolSchema)
  async myTool(params: z.infer<typeof testToolSchema>) {
    return { content: [{ type: 'text', text: `echo: ${params.input}` }] };
  }
}

@Injectable()
class TestResourceService {
  @McpResource({ name: 'test-resource', uri: 'test://data', description: 'Test resource' })
  async myResource() {
    return { contents: [{ uri: 'test://data', text: 'resource data' }] };
  }
}

@Injectable()
class TestPromptService {
  @McpPrompt({ name: 'test-prompt', description: 'A test prompt' })
  async myPrompt() {
    return { messages: [{ role: 'user', content: { type: 'text', text: 'hello' } }] };
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

    expect(mockServerConnect).toHaveBeenCalled();

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
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');

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
      expect.objectContaining({ capabilities: { logging: {}, tools: { listChanged: true } } }),
    );

    await module.close();
  });

  it('should create StdioServerTransport with custom streams', async () => {
    const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
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

  describe('auth provider wiring', () => {
    const resolveAuthSpy = jest.fn();

    @Injectable()
    class TestAuthProvider implements McpAuthProvider {
      resolveAuth(authInfo: McpAuthInfo | undefined) {
        resolveAuthSpy(authInfo);
        return authInfo ? { ...authInfo, extra: { enriched: true } } : undefined;
      }
    }

    beforeEach(() => resolveAuthSpy.mockClear());

    it('should resolve authProvider class through DI and wire to registry', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpStdioModule.registerAndServeStdio({
            metadata: { name: 'test-stdio', version: '1.0.0' },
            stdin: new PassThrough(),
            stdout: new PassThrough(),
            authProvider: TestAuthProvider,
          }),
        ],
      }).compile();

      await module.init();

      const registry = module.get(McpToolRegistry);
      let handlerAuth: any;
      registry.registerTool({ name: 'auth-test', description: 'd' }, jest.fn().mockImplementation((_p: any, ctx: any) => {
        handlerAuth = ctx.authInfo;
        return 'ok';
      }));

      const mockAuth = { token: 'test', clientId: 'c', scopes: [] };
      await registry.executeToolRaw('auth-test', {}, mockAuth);
      expect(resolveAuthSpy).toHaveBeenCalledWith(mockAuth);
      expect(handlerAuth.extra).toEqual({ enriched: true });

      await module.close();
    });

    it('should not set authProvider when not in config', async () => {
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
      registry.registerTool({ name: 'auth-test', description: 'd' }, jest.fn().mockImplementation((_p: any, ctx: any) => {
        handlerAuth = ctx.authInfo;
        return 'ok';
      }));

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
