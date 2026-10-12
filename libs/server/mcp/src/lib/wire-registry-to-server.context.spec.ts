import { Logger } from '@nestjs/common';
import { McpToolRegistry } from './mcp-tool-registry';
import { wireRegistryToServer } from './wire-registry-to-server';

jest.mock('@modelcontextprotocol/server', () => ({
  ...jest.requireActual('@modelcontextprotocol/server'),
  McpServer: jest.fn(),
  ResourceTemplate: jest
    .fn()
    .mockImplementation((uri: string, opts: unknown) => ({ uri, opts })),
}));

function createMockServer() {
  return {
    isConnected: jest.fn().mockReturnValue(false),
    registerTool: jest
      .fn()
      .mockReturnValue({ enable: jest.fn(), disable: jest.fn() }),
    registerResource: jest.fn(),
    registerPrompt: jest.fn(),
    sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
    server: {
      setRequestHandler: jest.fn(),
      registerCapabilities: jest.fn(),
      getClientCapabilities: jest
        .fn()
        .mockReturnValue({ sampling: {}, elicitation: {}, roots: {} }),
      sendResourceUpdated: jest.fn().mockResolvedValue(undefined),
      notification: jest.fn().mockResolvedValue(undefined),
      createMessage: jest.fn().mockResolvedValue({ role: 'assistant' }),
      elicitInput: jest.fn().mockResolvedValue({ action: 'accept' }),
      listRoots: jest.fn().mockResolvedValue({ roots: [{ uri: 'file:///' }] }),
    },
  } as any;
}

describe('wireRegistryToServer tool context', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    registry = new McpToolRegistry();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** A v2 handler context whose server-to-client requests answer like a client would. */
  function ctxOf(overrides: Record<string, any> = {}) {
    return {
      mcpReq: {
        id: 1,
        method: 'tools/call',
        signal: new AbortController().signal,
        notify: jest.fn().mockResolvedValue(undefined),
        log: jest.fn().mockResolvedValue(undefined),
        requestSampling: jest.fn().mockResolvedValue({ role: 'assistant' }),
        elicitInput: jest.fn().mockResolvedValue({ action: 'accept' }),
        send: jest.fn().mockResolvedValue({ roots: [{ uri: 'file:///' }] }),
        ...overrides,
      },
    };
  }

  async function invokeWithContext(
    use: (ctx: any) => Promise<unknown>,
    options: Parameters<typeof wireRegistryToServer>[2] = {},
    server = createMockServer(),
  ) {
    let seen: any;
    registry.registerTool(
      { name: 'ctx-tool', description: 'd' },
      async (_params: unknown, ctx?: any) => {
        seen = ctx;
        return use(ctx);
      },
    );
    wireRegistryToServer(registry, server, options);
    const sdkCtx = ctxOf();
    const result = await server.registerTool.mock.calls[0][2]({}, sdkCtx);
    return { sdkCtx, result, seen };
  }

  it('should send sampling requests through the request context', async () => {
    const params = { messages: [], maxTokens: 10 };

    const { sdkCtx, result } = await invokeWithContext((ctx) =>
      ctx.createMessage(params),
    );

    expect(sdkCtx.mcpReq.requestSampling).toHaveBeenCalledWith(params);
    expect(result.content[0].text).toContain('assistant');
  });

  it('should send elicitation requests through the request context', async () => {
    const params = { message: 'Name?', requestedSchema: {} };

    const { sdkCtx, result } = await invokeWithContext((ctx) =>
      ctx.elicitInput(params),
    );

    expect(sdkCtx.mcpReq.elicitInput).toHaveBeenCalledWith(params);
    expect(result.content[0].text).toContain('accept');
  });

  it('should send roots requests through the request context', async () => {
    const { sdkCtx, result } = await invokeWithContext((ctx) =>
      ctx.listRoots(),
    );

    expect(sdkCtx.mcpReq.send).toHaveBeenCalledWith({ method: 'roots/list' });
    expect(result.content[0].text).toContain('file:///');
  });

  it('should tolerate a missing context', async () => {
    const server = createMockServer();
    registry.registerTool(
      { name: 'no-ctx', description: 'd' },
      async (_params: unknown, ctx?: any) => ({
        sessionId: ctx.sessionId ?? null,
        hasProgress: !!ctx.sendProgress,
        hasRoots: !!ctx.listRoots,
      }),
    );
    wireRegistryToServer(registry, server);

    const result = await server.registerTool.mock.calls[0][2]({});

    expect(JSON.parse(result.content[0].text)).toEqual({
      sessionId: null,
      hasProgress: false,
      hasRoots: false,
    });
  });

  it('should surface rejections from client requests as tool errors', async () => {
    const server = createMockServer();
    registry.registerTool(
      { name: 'elicit', description: 'd' },
      async (_params: unknown, ctx?: any) => ctx.elicitInput({ message: 'x' }),
    );
    wireRegistryToServer(registry, server);

    const sdkCtx = ctxOf({
      elicitInput: jest
        .fn()
        .mockRejectedValue(new Error('client does not support elicitation')),
    });
    const result = await server.registerTool.mock.calls[0][2]({}, sdkCtx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe(
      'Error executing elicit: Internal error',
    );
  });

  it('should leave out client requests the client did not declare', async () => {
    const server = createMockServer();
    server.server.getClientCapabilities.mockReturnValue({ roots: {} });

    const { seen } = await invokeWithContext(async () => 'ok', {}, server);

    expect(seen.createMessage).toBeUndefined();
    expect(seen.elicitInput).toBeUndefined();
    expect(seen.listRoots).toBeDefined();
  });

  it('should leave out client requests before the client initialized (stateless HTTP)', async () => {
    const server = createMockServer();
    server.server.getClientCapabilities.mockReturnValue(undefined);

    const { seen } = await invokeWithContext(async () => 'ok', {}, server);

    expect(seen.createMessage).toBeUndefined();
    expect(seen.elicitInput).toBeUndefined();
    expect(seen.listRoots).toBeUndefined();
  });

  it('should leave out client requests on 2026-07-28 servers, which ask with inputRequired', async () => {
    const { seen } = await invokeWithContext(async () => 'ok', {
      era: 'modern',
    });

    expect(seen.era).toBe('modern');
    expect(seen.createMessage).toBeUndefined();
    expect(seen.elicitInput).toBeUndefined();
    expect(seen.listRoots).toBeUndefined();
    expect(seen.sendLog).toBeDefined();
  });

  it('should leave out everything request-scoped when the transport drops it (JSON responses)', async () => {
    const { seen } = await invokeWithContext(async () => 'ok', {
      requestScopedMessages: false,
    });

    expect(seen.sendProgress).toBeUndefined();
    expect(seen.sendLog).toBeUndefined();
    expect(seen.createMessage).toBeUndefined();
    expect(seen.elicitInput).toBeUndefined();
    expect(seen.listRoots).toBeUndefined();
  });

  it('should pass an inputRequired result through to the SDK', async () => {
    const asked = {
      resultType: 'input_required',
      inputRequests: { confirm: { method: 'elicitation/create', params: {} } },
    };

    const { result } = await invokeWithContext(async () => asked);

    expect(result).toBe(asked);
  });
});

describe('wireRegistryToServer dynamic registration', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    registry = new McpToolRegistry();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should wire resources registered after initial wiring', async () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    registry.registerResource(
      { name: 'late-res', uri: 'app://late', mimeType: 'text/plain' },
      async () => 'late data',
    );

    expect(server.registerResource).toHaveBeenCalledTimes(1);
    const [name, uri, config, read] = server.registerResource.mock.calls[0];
    expect(name).toBe('late-res');
    expect(uri).toBe('app://late');
    expect(config).toEqual({ mimeType: 'text/plain' });
    await expect(read(new URL('app://late'), {})).resolves.toEqual({
      contents: [
        { uri: 'app://late', mimeType: 'text/plain', text: 'late data' },
      ],
    });
  });

  it('should wire prompts registered after initial wiring', async () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    registry.registerPrompt(
      { name: 'late-prompt', description: 'Later' },
      async () => 'prompt text',
    );

    expect(server.registerPrompt).toHaveBeenCalledTimes(1);
    const [name, config, handler] = server.registerPrompt.mock.calls[0];
    expect(name).toBe('late-prompt');
    expect(config).toEqual(expect.objectContaining({ description: 'Later' }));
    const result = await handler({});
    expect(result.messages[0].content).toEqual({
      type: 'text',
      text: 'prompt text',
    });
  });

  it('should stop wiring resources and prompts after unsubscribe', () => {
    const server = createMockServer();
    const unsubscribe = wireRegistryToServer(registry, server);
    unsubscribe();

    registry.registerResource({ name: 'r', uri: 'app://r' }, jest.fn());
    registry.registerPrompt({ name: 'p' }, jest.fn());

    expect(server.registerResource).not.toHaveBeenCalled();
    expect(server.registerPrompt).not.toHaveBeenCalled();
  });

  it('should swallow errors when forwarding resource updates to a disconnected client', async () => {
    const server = createMockServer();
    server.server.sendResourceUpdated.mockRejectedValue(
      new Error('disconnected'),
    );
    wireRegistryToServer(registry, server);

    const subscribe = server.server.setRequestHandler.mock.calls.find(
      (c: any[]) => c[0] === 'resources/subscribe',
    )[1];
    subscribe({ params: { uri: 'app://x' } }, { sessionId: 's1' });

    const unhandled = jest.fn();
    process.on('unhandledRejection', unhandled);
    try {
      expect(() => registry.notifyResourceUpdated('app://x')).not.toThrow();
      await new Promise((resolve) => setImmediate(resolve));
      expect(unhandled).not.toHaveBeenCalled();
    } finally {
      process.off('unhandledRejection', unhandled);
    }
    expect(server.server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: 'app://x',
    });
  });
});
