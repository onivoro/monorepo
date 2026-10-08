import { AgenticToolDefinition } from '@onivoro/isomorphic-agentic';
import { McpLlmToolAdapter } from '@onivoro/server-mcp-llm-adapter';
import { AgenticMcpConfig } from './agentic-mcp-config';
import { McpRegistryAgenticToolProvider } from './mcp-registry-agentic-tool-provider.service';

const tools: AgenticToolDefinition[] = [
  {
    name: 'mcp__mcp__lookup',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string' }, customerId: { type: 'string' } },
    },
  },
];

function setup(config: AgenticMcpConfig = {}) {
  const adapter = {
    toProviderTools: jest.fn().mockReturnValue(tools),
    executeToolCallForProvider: jest.fn(),
    resolveProviderToolName: jest.fn().mockReturnValue('lookup'),
  };
  const provider = new McpRegistryAgenticToolProvider(
    adapter as unknown as McpLlmToolAdapter<AgenticToolDefinition>,
    config,
  );
  return { adapter, provider };
}

describe(McpRegistryAgenticToolProvider.name, () => {
  it('lists the adapter provider tools', async () => {
    const { provider } = setup();
    await expect(provider.listTools()).resolves.toBe(tools);
  });

  it('executes through the adapter with context-filled params and execution extras', async () => {
    const { adapter, provider } = setup({
      namespace: 'ns',
      inputContext: { contextKeys: ['customerId'] },
    });
    adapter.executeToolCallForProvider.mockResolvedValue({
      providerName: 'mcp__mcp__lookup',
      id: 'call-1',
      result: '{"ok":true}',
      success: true,
    });
    const authInfo = { token: 't', clientId: 'c', scopes: [] };
    const signal = new AbortController().signal;
    const sendProgress = jest.fn();
    const sendLog = jest.fn();

    const result = await provider.executeTool(
      { id: 'call-1', name: 'mcp__mcp__lookup', input: { id: 'x' } },
      {
        conversationId: 'c',
        runId: 'r',
        sessionId: 's',
        authInfo,
        signal,
        sendProgress,
        sendLog,
        metadata: { customerId: 'cust-1' },
      },
    );

    expect(adapter.executeToolCallForProvider).toHaveBeenCalledWith(
      {
        providerName: 'mcp__mcp__lookup',
        params: { id: 'x', customerId: 'cust-1' },
        id: 'call-1',
      },
      authInfo,
      { sessionId: 's', signal, sendProgress, sendLog },
    );
    expect(adapter.resolveProviderToolName).toHaveBeenCalledWith(
      'mcp__mcp__lookup',
    );
    expect(result).toEqual({
      toolCallId: 'call-1',
      name: 'mcp__mcp__lookup',
      result: '{"ok":true}',
      resultText: '{"ok":true}',
      providerMetadata: { mcp: { originalName: 'lookup', namespace: 'ns' } },
    });
  });

  it('returns a failed tool as an error result with the default namespace', async () => {
    const { adapter, provider } = setup();
    adapter.executeToolCallForProvider.mockResolvedValue({
      providerName: 'mcp__mcp__lookup',
      id: 'call-1',
      error: 'not allowed',
      success: false,
    });

    await expect(
      provider.executeTool(
        { id: 'call-1', name: 'mcp__mcp__lookup', input: {} },
        { conversationId: 'c', runId: 'r' },
      ),
    ).resolves.toEqual({
      toolCallId: 'call-1',
      name: 'mcp__mcp__lookup',
      result: 'not allowed',
      resultText: 'not allowed',
      isError: true,
      providerMetadata: { mcp: { originalName: 'lookup', namespace: 'mcp' } },
    });
  });

  it('describes a failure without an error message generically', async () => {
    const { adapter, provider } = setup();
    adapter.executeToolCallForProvider.mockResolvedValue({ success: false });
    adapter.resolveProviderToolName.mockReturnValue(undefined);

    await expect(
      provider.executeTool(
        { id: 'call-1', name: 'unknown', input: 'not an object' },
        { conversationId: 'c', runId: 'r' },
      ),
    ).resolves.toMatchObject({
      resultText: 'Tool execution failed',
      isError: true,
      providerMetadata: { mcp: { originalName: undefined } },
    });
    expect(adapter.executeToolCallForProvider.mock.calls[0][0].params).toEqual(
      {},
    );
  });
});
