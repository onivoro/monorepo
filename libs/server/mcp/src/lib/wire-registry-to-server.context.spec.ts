import { Logger } from '@nestjs/common';
import { McpToolRegistry } from './mcp-tool-registry';
import { wireRegistryToServer } from './wire-registry-to-server';

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn(),
  ResourceTemplate: jest
    .fn()
    .mockImplementation((uri: string, opts: unknown) => ({ uri, opts })),
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  SubscribeRequestSchema: { method: 'resources/subscribe' },
  UnsubscribeRequestSchema: { method: 'resources/unsubscribe' },
}));

function createMockServer() {
  return {
    registerTool: jest
      .fn()
      .mockReturnValue({ enable: jest.fn(), disable: jest.fn() }),
    registerResource: jest.fn(),
    registerPrompt: jest.fn(),
    sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
    server: {
      setRequestHandler: jest.fn(),
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

  async function invokeWithContext(
    use: (ctx: any) => Promise<unknown>,
    extra: Record<string, unknown> = {},
  ) {
    const server = createMockServer();
    registry.registerTool(
      { name: 'ctx-tool', description: 'd' },
      async (_params: unknown, ctx?: any) => use(ctx),
    );
    wireRegistryToServer(registry, server);
    const callback = server.registerTool.mock.calls[0][2];
    const result = await callback({}, extra);
    return { server, result };
  }

  it('should forward createMessage to the low-level server with the request signal', async () => {
    const signal = new AbortController().signal;
    const params = { messages: [], maxTokens: 10 };

    const { server, result } = await invokeWithContext(
      (ctx) => ctx.createMessage(params),
      { signal },
    );

    expect(server.server.createMessage).toHaveBeenCalledWith(params, {
      signal,
    });
    expect(result.content[0].text).toContain('assistant');
  });

  it('should forward elicitInput to the low-level server with the request signal', async () => {
    const signal = new AbortController().signal;
    const params = { message: 'Name?', requestedSchema: {} };

    const { server, result } = await invokeWithContext(
      (ctx) => ctx.elicitInput(params),
      { signal },
    );

    expect(server.server.elicitInput).toHaveBeenCalledWith(params, { signal });
    expect(result.content[0].text).toContain('accept');
  });

  it('should forward listRoots to the low-level server with the request signal', async () => {
    const signal = new AbortController().signal;

    const { server, result } = await invokeWithContext(
      (ctx) => ctx.listRoots(),
      { signal },
    );

    expect(server.server.listRoots).toHaveBeenCalledWith(undefined, {
      signal,
    });
    expect(result.content[0].text).toContain('file:///');
  });

  it('should tolerate a missing extra argument', async () => {
    const server = createMockServer();
    registry.registerTool(
      { name: 'no-extra', description: 'd' },
      async (_params: unknown, ctx?: any) => {
        await ctx.listRoots();
        return {
          sessionId: ctx.sessionId ?? null,
          hasProgress: !!ctx.sendProgress,
        };
      },
    );
    wireRegistryToServer(registry, server);

    const result = await server.registerTool.mock.calls[0][2]({});

    expect(server.server.listRoots).toHaveBeenCalledWith(undefined, {
      signal: undefined,
    });
    expect(JSON.parse(result.content[0].text)).toEqual({
      sessionId: null,
      hasProgress: false,
    });
  });

  it('should surface rejections from client requests as tool errors', async () => {
    const server = createMockServer();
    server.server.elicitInput.mockRejectedValueOnce(
      new Error('client does not support elicitation'),
    );
    registry.registerTool(
      { name: 'elicit', description: 'd' },
      async (_params: unknown, ctx?: any) => ctx.elicitInput({ message: 'x' }),
    );
    wireRegistryToServer(registry, server);

    const result = await server.registerTool.mock.calls[0][2]({});

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(
      'client does not support elicitation',
    );
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

    const subscribe = server.server.setRequestHandler.mock.calls[0][1];
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
