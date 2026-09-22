import { StandardMcpClientAgenticToolProvider } from './standard-mcp-client-agentic-tool-provider';

describe(StandardMcpClientAgenticToolProvider.name, () => {
  it('adapts a standard MCP client without owning its transport', async () => {
    const client = {
      listTools: jest.fn().mockResolvedValue({
        tools: [
          {
            name: 'read_file',
            description: 'Read a file',
            inputSchema: { type: 'object' },
          },
        ],
      }),
      callTool: jest.fn().mockResolvedValue({
        content: [{ type: 'text', text: 'ok' }],
      }),
    };
    const provider = new StandardMcpClientAgenticToolProvider(client, {
      namespace: 'workspace',
    });

    await expect(
      provider.listTools({ conversationId: 'c', runId: 'r' }),
    ).resolves.toMatchObject([
      {
        name: 'mcp__workspace__read_file',
        inputSchema: { type: 'object' },
      },
    ]);

    await provider.executeTool(
      {
        id: 'call-1',
        name: 'mcp__workspace__read_file',
        input: { path: 'README.md' },
      },
      { conversationId: 'c', runId: 'r' },
    );

    expect(client.callTool).toHaveBeenCalledWith({
      name: 'read_file',
      arguments: { path: 'README.md' },
    });
  });

  it('fills a declared identifier from conversation metadata', async () => {
    const client = {
      listTools: jest.fn().mockResolvedValue({
        tools: [
          {
            name: 'get_invoice',
            inputSchema: {
              type: 'object',
              properties: {
                invoiceId: { type: 'number' },
              },
            },
          },
        ],
      }),
      callTool: jest.fn().mockResolvedValue({ ok: true }),
    };
    const provider = new StandardMcpClientAgenticToolProvider(client, {
      namespace: 'workspace',
      inputContext: { contextKeys: ['invoiceId'] },
    });

    await provider.executeTool(
      {
        id: 'call-1',
        name: 'mcp__workspace__get_invoice',
        input: {},
      },
      {
        conversationId: 'c',
        runId: 'r',
        metadata: {
          invoiceId: 4471,
        },
      },
    );

    expect(client.callTool).toHaveBeenCalledWith({
      name: 'get_invoice',
      arguments: { invoiceId: 4471 },
    });
  });

  it('fills identifiers when standard MCP tool names are not namespaced', async () => {
    const client = {
      listTools: jest.fn().mockResolvedValue({
        tools: [
          {
            name: 'get_shipment',
            inputSchema: {
              type: 'object',
              properties: {
                shipmentId: { type: 'number' },
              },
            },
          },
        ],
      }),
      callTool: jest.fn().mockResolvedValue({ ok: true }),
    };
    const provider = new StandardMcpClientAgenticToolProvider(client, {
      exposeNamespace: false,
      inputContext: { contextKeys: ['shipmentId'] },
    });

    await provider.executeTool(
      {
        id: 'call-1',
        name: 'get_shipment',
        input: {},
      },
      {
        conversationId: 'c',
        runId: 'r',
        metadata: {
          shipmentId: 8812,
        },
      },
    );

    expect(client.callTool).toHaveBeenCalledWith({
      name: 'get_shipment',
      arguments: { shipmentId: 8812 },
    });
  });

  it('serializes undefined standard MCP results as null result text', async () => {
    const client = {
      listTools: jest.fn().mockResolvedValue({
        tools: [
          {
            name: 'get_order',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'number' },
              },
            },
          },
        ],
      }),
      callTool: jest.fn().mockResolvedValue(undefined),
    };
    const provider = new StandardMcpClientAgenticToolProvider(client, {
      namespace: 'workspace',
    });

    await expect(
      provider.executeTool(
        {
          id: 'call-1',
          name: 'mcp__workspace__get_order',
          input: { id: 4250578 },
        },
        { conversationId: 'c', runId: 'r' },
      ),
    ).resolves.toMatchObject({
      result: undefined,
      resultText: 'null',
    });
  });
});
