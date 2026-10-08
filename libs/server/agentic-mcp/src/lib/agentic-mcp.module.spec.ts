import { Injectable, Logger, Module } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AGENTIC_TOOL_PROVIDER } from '@onivoro/server-agentic';
import { McpTool, McpToolRegistry } from '@onivoro/server-mcp';
import { McpLlmToolAdapter } from '@onivoro/server-mcp-llm-adapter';
import { z } from 'zod';
import { AGENTIC_MCP_CONFIG } from './agentic-mcp-config';
import { AgenticMcpModule } from './agentic-mcp.module';
import { McpRegistryAgenticToolProvider } from './mcp-registry-agentic-tool-provider.service';

@Injectable()
class EchoTools {
  @McpTool({
    name: 'echo',
    description: 'Echo input',
    schema: z.object({ input: z.string(), customerId: z.string().optional() }),
  })
  async echo(params: { input: string; customerId?: string }) {
    return `echo: ${params.input}${params.customerId ? ` for ${params.customerId}` : ''}`;
  }

  @McpTool({ name: 'boom', description: 'Always fails' })
  async boom(): Promise<string> {
    throw new Error('kaboom');
  }
}

const context = { conversationId: 'c', runId: 'r' };

describe(AgenticMcpModule.name, () => {
  let moduleRef: TestingModule;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(async () => {
    await moduleRef?.close();
    jest.restoreAllMocks();
  });

  it('exposes registry tools through the agentic tool provider token', async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        AgenticMcpModule.configure({
          namespace: 'app',
          inputContext: { contextKeys: ['customerId'] },
        }),
      ],
      providers: [EchoTools],
    }).compile();
    await moduleRef.init();

    const provider = moduleRef.get(AGENTIC_TOOL_PROVIDER);
    expect(provider).toBe(moduleRef.get(McpRegistryAgenticToolProvider));
    expect(moduleRef.get(AGENTIC_MCP_CONFIG)).toMatchObject({
      namespace: 'app',
    });
    expect(moduleRef.get(McpLlmToolAdapter)).toBeInstanceOf(McpLlmToolAdapter);

    const tools = await provider.listTools(context);
    expect(tools.map((t: { name: string }) => t.name).sort()).toEqual([
      'mcp__app__boom',
      'mcp__app__echo',
    ]);

    await expect(
      provider.executeTool(
        { id: 'call-1', name: 'mcp__app__echo', input: { input: 'hi' } },
        { ...context, metadata: { customerId: 'cust-9' } },
      ),
    ).resolves.toEqual({
      toolCallId: 'call-1',
      name: 'mcp__app__echo',
      result: 'echo: hi for cust-9',
      resultText: 'echo: hi for cust-9',
      providerMetadata: { mcp: { originalName: 'echo', namespace: 'app' } },
    });

    await expect(
      provider.executeTool(
        { id: 'call-2', name: 'mcp__app__boom', input: {} },
        context,
      ),
    ).resolves.toMatchObject({
      toolCallId: 'call-2',
      isError: true,
      providerMetadata: { mcp: { originalName: 'boom', namespace: 'app' } },
    });
  });

  it('accepts a host module that already exports the registry', async () => {
    const registry = new McpToolRegistry();

    @Module({
      providers: [{ provide: McpToolRegistry, useValue: registry }],
      exports: [McpToolRegistry],
    })
    class HostRegistryModule {}

    moduleRef = await Test.createTestingModule({
      imports: [AgenticMcpModule.configure({}, [HostRegistryModule])],
    }).compile();

    const provider = moduleRef.get(McpRegistryAgenticToolProvider);
    await expect(provider.listTools(context)).resolves.toEqual([]);
  });

  it('describes a dynamic module with defaults', () => {
    const dynamic = AgenticMcpModule.configure();
    expect(dynamic.module).toBe(AgenticMcpModule);
    expect(dynamic.imports).toHaveLength(1);
    expect(dynamic.exports).toEqual([
      AGENTIC_MCP_CONFIG,
      McpLlmToolAdapter,
      McpRegistryAgenticToolProvider,
      AGENTIC_TOOL_PROVIDER,
    ]);
  });
});
