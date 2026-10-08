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

describe(`${StandardMcpClientAgenticToolProvider.name} (name resolution)`, () => {
  const context = { conversationId: 'c', runId: 'r' };

  function setup(
    tools: Array<{ name: string; inputSchema?: Record<string, unknown> }>,
    config?: ConstructorParameters<
      typeof StandardMcpClientAgenticToolProvider
    >[1],
    result: unknown = 'done',
  ) {
    const client = {
      listTools: jest.fn().mockResolvedValue({ tools }),
      callTool: jest.fn().mockResolvedValue(result),
    };
    return {
      client,
      provider: new StandardMcpClientAgenticToolProvider(client, config),
    };
  }

  it('lists tools with a default schema, sanitized names and metadata', async () => {
    const { provider } = setup([{ name: 'read.file' }]);
    await expect(provider.listTools()).resolves.toEqual([
      {
        name: 'mcp__mcp__read_file',
        description: undefined,
        inputSchema: { type: 'object', properties: {} },
        providerMetadata: {
          mcp: {
            originalName: 'read.file',
            namespace: 'mcp',
            client: 'standard',
          },
        },
      },
    ]);
  });

  it('maps a sanitized exposed name back to the original tool name', async () => {
    const { client, provider } = setup([{ name: 'read.file' }]);
    const result = await provider.executeTool(
      { id: '1', name: 'mcp__mcp__read_file', input: { a: 1 } },
      context,
    );
    expect(client.callTool).toHaveBeenCalledWith({
      name: 'read.file',
      arguments: { a: 1 },
    });
    expect(result).toEqual({
      toolCallId: '1',
      name: 'mcp__mcp__read_file',
      result: 'done',
      resultText: 'done',
      providerMetadata: {
        mcp: {
          originalName: 'read.file',
          namespace: 'mcp',
          client: 'standard',
        },
      },
    });
  });

  it('falls back to the unprefixed sanitized name when no tool matches', async () => {
    const { client, provider } = setup([]);
    await provider.executeTool(
      { id: '1', name: 'mcp__mcp__ghost', input: {} },
      context,
    );
    expect(client.callTool).toHaveBeenCalledWith({
      name: 'ghost',
      arguments: {},
    });
  });

  it('accepts an unprefixed name when namespaces are exposed', async () => {
    const { client, provider } = setup([{ name: 'raw' }]);
    await provider.executeTool({ id: '1', name: 'raw', input: {} }, context);
    await provider.executeTool(
      { id: '2', name: 'unknown', input: {} },
      context,
    );
    expect(client.callTool.mock.calls.map(([params]) => params.name)).toEqual([
      'raw',
      'unknown',
    ]);
  });

  it('lists raw names when namespaces are not exposed', async () => {
    const { provider } = setup([{ name: 'read.file' }], {
      exposeNamespace: false,
    });
    await expect(provider.listTools()).resolves.toMatchObject([
      { name: 'read.file' },
    ]);
  });

  it('passes an unknown name through when namespaces are not exposed', async () => {
    const { client, provider } = setup([], { exposeNamespace: false });
    await provider.executeTool(
      { id: '1', name: 'whatever', input: {} },
      context,
    );
    expect(client.callTool).toHaveBeenCalledWith({
      name: 'whatever',
      arguments: {},
    });
  });

  it('stringifies object results and falls back to String() for circular ones', async () => {
    const { provider } = setup([{ name: 'x' }], {}, { ok: true });
    await expect(
      provider.executeTool(
        { id: '1', name: 'mcp__mcp__x', input: {} },
        context,
      ),
    ).resolves.toMatchObject({
      resultText: JSON.stringify({ ok: true }, null, 2),
    });

    const circular: Record<string, unknown> = {};
    circular['self'] = circular;
    const { provider: circularProvider } = setup([{ name: 'x' }], {}, circular);
    await expect(
      circularProvider.executeTool(
        { id: '1', name: 'mcp__mcp__x', input: {} },
        context,
      ),
    ).resolves.toMatchObject({ resultText: '[object Object]' });
  });

  it('propagates client failures', async () => {
    const { client, provider } = setup([{ name: 'x' }]);
    client.callTool.mockRejectedValue(new Error('transport closed'));
    await expect(
      provider.executeTool(
        { id: '1', name: 'mcp__mcp__x', input: {} },
        context,
      ),
    ).rejects.toThrow('transport closed');
  });
});
