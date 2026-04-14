import { Injectable } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { McpModule } from './mcp.module';
import { McpService } from './mcp.service';
import { McpTool, McpResource, McpPrompt } from './mcp.decorator';
import { z } from 'zod';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: jest.fn(),
    registerResource: jest.fn(),
    registerPrompt: jest.fn(),
    connect: jest.fn(),
    close: jest.fn(),
  })),
  ResourceTemplate: jest.fn(),
}));

jest.mock('@modelcontextprotocol/sdk/server/streamableHttp.js', () => ({
  StreamableHTTPServerTransport: jest.fn().mockImplementation((opts: any) => ({
    handleRequest: jest.fn().mockResolvedValue(undefined),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));

@Injectable()
class TestToolService {
  @McpTool('test-tool', 'A test tool', { input: z.string().describe('test input') })
  async myTool(params: { input: string }) {
    return { content: [{ type: 'text', text: `echo: ${params.input}` }] };
  }

  @McpTool('string-tool', 'Returns a string')
  async stringTool() {
    return 'plain string result';
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

describe('McpModule', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should compile the module with configure()', async () => {
    const module = await Test.createTestingModule({
      imports: [
        McpModule.configure({
          metadata: { name: 'test', version: '1.0.0' },
        }),
      ],
    }).compile();

    const service = module.get(McpService);
    expect(service).toBeDefined();

    await module.close();
  });

  describe('tool discovery', () => {
    it('should discover @McpTool decorated methods and register them', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpModule.configure({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
        providers: [TestToolService],
      }).compile();

      await module.init();

      const service = module.get(McpService);
      // Access private registry to verify registration
      const registry = (service as any).toolRegistry;
      const toolNames = registry.map((t: any) => t.metadata.name);

      expect(toolNames).toContain('test-tool');
      expect(toolNames).toContain('string-tool');

      await module.close();
    });

    it('should auto-wrap non-content tool results', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpModule.configure({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
        providers: [TestToolService],
      }).compile();

      await module.init();

      const service = module.get(McpService);
      const registry = (service as any).toolRegistry;
      const stringTool = registry.find((t: any) => t.metadata.name === 'string-tool');

      const result = await stringTool.handler({});
      expect(result).toEqual({
        content: [{ type: 'text', text: 'plain string result' }],
      });

      await module.close();
    });

    it('should pass through results that already have content', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpModule.configure({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
        providers: [TestToolService],
      }).compile();

      await module.init();

      const service = module.get(McpService);
      const registry = (service as any).toolRegistry;
      const testTool = registry.find((t: any) => t.metadata.name === 'test-tool');

      const result = await testTool.handler({ input: 'hello' });
      expect(result).toEqual({
        content: [{ type: 'text', text: 'echo: hello' }],
      });

      await module.close();
    });
  });

  describe('resource discovery', () => {
    it('should discover @McpResource decorated methods', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpModule.configure({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
        providers: [TestResourceService],
      }).compile();

      await module.init();

      const service = module.get(McpService);
      const registry = (service as any).resourceRegistry;
      expect(registry).toHaveLength(1);
      expect(registry[0].metadata.name).toBe('test-resource');

      await module.close();
    });
  });

  describe('prompt discovery', () => {
    it('should discover @McpPrompt decorated methods', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpModule.configure({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
        providers: [TestPromptService],
      }).compile();

      await module.init();

      const service = module.get(McpService);
      const registry = (service as any).promptRegistry;
      expect(registry).toHaveLength(1);
      expect(registry[0].metadata.name).toBe('test-prompt');

      await module.close();
    });
  });

  describe('routePrefix', () => {
    it('should create a controller with default /mcp route when no prefix', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpModule.configure({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
      }).compile();

      const app = module.createNestApplication();
      await app.init();

      const httpServer = app.getHttpServer();
      expect(httpServer).toBeDefined();

      await app.close();
    });

    it('should create a controller with prefixed route when routePrefix is set', async () => {
      const module = await Test.createTestingModule({
        imports: [
          McpModule.configure({
            metadata: { name: 'test', version: '1.0.0' },
            routePrefix: 'api/v1',
          }),
        ],
      }).compile();

      const app = module.createNestApplication();
      await app.init();

      const httpServer = app.getHttpServer();
      expect(httpServer).toBeDefined();

      await app.close();
    });
  });

  describe('error handling in discovery', () => {
    it('should catch tool execution errors and return error content', async () => {
      @Injectable()
      class FailingToolService {
        @McpTool('failing-tool', 'A tool that fails')
        async failTool() {
          throw new Error('tool exploded');
        }
      }

      const module = await Test.createTestingModule({
        imports: [
          McpModule.configure({
            metadata: { name: 'test', version: '1.0.0' },
          }),
        ],
        providers: [FailingToolService],
      }).compile();

      await module.init();

      const service = module.get(McpService);
      const registry = (service as any).toolRegistry;
      const failingTool = registry.find((t: any) => t.metadata.name === 'failing-tool');

      const result = await failingTool.handler({});
      expect(result.content[0].text).toContain('Error executing failing-tool');
      expect(result.content[0].text).toContain('tool exploded');

      await module.close();
    });
  });
});
