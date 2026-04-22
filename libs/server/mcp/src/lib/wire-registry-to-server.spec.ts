import { McpToolRegistry } from './mcp-tool-registry';
import { buildCapabilities, wireRegistryToServer } from './wire-registry-to-server';
import { z } from 'zod';

const mockEnable = jest.fn();
const mockDisable = jest.fn();
const mockRegisterTool = jest.fn().mockReturnValue({ enable: mockEnable, disable: mockDisable });
const mockRegisterResource = jest.fn();
const mockRegisterPrompt = jest.fn();
const mockSetRequestHandler = jest.fn();
const mockSendResourceUpdated = jest.fn().mockResolvedValue(undefined);

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn(),
  ResourceTemplate: jest.fn().mockImplementation((uri: string) => ({ uri })),
}));

jest.mock('@modelcontextprotocol/sdk/types.js', () => ({
  SubscribeRequestSchema: { method: 'resources/subscribe' },
  UnsubscribeRequestSchema: { method: 'resources/unsubscribe' },
}));

function createMockServer() {
  return {
    registerTool: mockRegisterTool,
    registerResource: mockRegisterResource,
    registerPrompt: mockRegisterPrompt,
    sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
    server: {
      setRequestHandler: mockSetRequestHandler,
      sendResourceUpdated: mockSendResourceUpdated,
      notification: jest.fn().mockResolvedValue(undefined),
      createMessage: jest.fn().mockResolvedValue({}),
      elicitInput: jest.fn().mockResolvedValue({}),
      listRoots: jest.fn().mockResolvedValue({ roots: [] }),
    },
  } as any;
}

describe('buildCapabilities', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    registry = new McpToolRegistry();
  });

  it('should include logging capability by default', () => {
    expect(buildCapabilities(registry)).toEqual({ logging: {} });
  });

  it('should include logging when explicitly enabled', () => {
    expect(buildCapabilities(registry, { logging: true })).toEqual({ logging: {} });
  });

  it('should omit logging when explicitly disabled', () => {
    expect(buildCapabilities(registry, { logging: false })).toEqual({});
  });

  it('should include tools key with listChanged when tools are registered', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());
    const caps = buildCapabilities(registry);
    expect(caps).toEqual({ logging: {}, tools: { listChanged: true } });
  });

  it('should include all keys with listChanged when tools, resources, and prompts are registered', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());
    registry.registerResource({ name: 'res', uri: 'app://res' }, jest.fn());
    registry.registerPrompt({ name: 'prompt' }, jest.fn());
    const caps = buildCapabilities(registry);
    expect(caps).toEqual({
      logging: {},
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
    });
  });

  it('should omit logging but keep other capabilities when logging is disabled', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());
    const caps = buildCapabilities(registry, { logging: false });
    expect(caps).toEqual({ tools: { listChanged: true } });
  });
});

describe('wireRegistryToServer', () => {
  let registry: McpToolRegistry;

  beforeEach(() => {
    jest.clearAllMocks();
    registry = new McpToolRegistry();
  });

  it('should register tools with correct args', () => {
    const schema = z.object({ text: z.string() });
    registry.registerTool({ name: 'my-tool', description: 'A tool', schema }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterTool).toHaveBeenCalledTimes(1);
    expect(mockRegisterTool).toHaveBeenCalledWith(
      'my-tool',
      { description: 'A tool', inputSchema: schema },
      expect.any(Function),
    );
  });

  it('should pass tool annotations to the server when present', () => {
    const annotations = { readOnlyHint: true, destructiveHint: false };
    registry.registerTool(
      { name: 'read-tool', description: 'Reads data', annotations },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config.annotations).toEqual(annotations);
  });

  it('should omit annotations from tool config when not present', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config).not.toHaveProperty('annotations');
  });

  it('should pass tool title to the server when present', () => {
    registry.registerTool(
      { name: 'list-items', description: 'List items', title: 'List Items' },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config.title).toBe('List Items');
  });

  it('should pass outputSchema to the server when present', () => {
    const outputSchema = z.object({ result: z.string() });
    registry.registerTool(
      { name: 'structured-tool', description: 'Returns structured', outputSchema },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config.outputSchema).toBe(outputSchema);
  });

  it('should omit outputSchema when not present', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config).not.toHaveProperty('outputSchema');
  });

  it('should omit tool title when not present', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config).not.toHaveProperty('title');
  });

  it('should delegate tool callback to registry.executeToolWrapped', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({ text: 'hello' });
    expect(handler).toHaveBeenCalledWith(
      { text: 'hello' },
      expect.objectContaining({ toolName: 'tool', params: { text: 'hello' } }),
    );
  });

  it('should forward authInfo from MCP SDK extra parameter', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    const mockAuthInfo = { token: 'abc', clientId: 'c1', scopes: ['read'] };
    await callback({ text: 'hi' }, { authInfo: mockAuthInfo, signal: new AbortController().signal });

    expect(handler).toHaveBeenCalledWith(
      { text: 'hi' },
      expect.objectContaining({ authInfo: mockAuthInfo }),
    );
  });

  it('should forward sessionId and signal from MCP SDK extra parameter', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    const abortController = new AbortController();
    await callback(
      { text: 'hi' },
      { authInfo: undefined, sessionId: 'sess-42', signal: abortController.signal },
    );

    expect(handler).toHaveBeenCalledWith(
      { text: 'hi' },
      expect.objectContaining({
        sessionId: 'sess-42',
        signal: abortController.signal,
      }),
    );
  });

  it('should provide sendProgress when extra has _meta.progressToken', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    const mockNotification = jest.fn().mockResolvedValue(undefined);
    const server = createMockServer();
    server.server.notification = mockNotification;

    wireRegistryToServer(registry, server);

    const callback = mockRegisterTool.mock.calls[0][2];
    await callback(
      {},
      { _meta: { progressToken: 'tok-1' }, signal: new AbortController().signal },
    );

    const context = handler.mock.calls[0][1];
    expect(context.sendProgress).toBeDefined();

    await context.sendProgress(50, 100, 'halfway');
    expect(mockNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'notifications/progress',
        params: expect.objectContaining({
          progressToken: 'tok-1',
          progress: 50,
          total: 100,
          message: 'halfway',
        }),
      }),
    );
  });

  it('should not provide sendProgress when extra has no progressToken', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({}, { signal: new AbortController().signal });

    const context = handler.mock.calls[0][1];
    expect(context.sendProgress).toBeUndefined();
  });

  it('should provide sendLog that delegates to server.sendLoggingMessage', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    const mockSendLoggingMessage = jest.fn().mockResolvedValue(undefined);
    const server = createMockServer();
    server.sendLoggingMessage = mockSendLoggingMessage;

    wireRegistryToServer(registry, server);

    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({}, { signal: new AbortController().signal });

    const context = handler.mock.calls[0][1];
    expect(context.sendLog).toBeDefined();

    await context.sendLog('info', { message: 'test' }, 'my-tool');
    expect(mockSendLoggingMessage).toHaveBeenCalledWith({
      level: 'info',
      data: { message: 'test' },
      logger: 'my-tool',
    });
  });

  it('should omit logger from sendLog when not provided', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    const mockSendLoggingMessage = jest.fn().mockResolvedValue(undefined);
    const server = createMockServer();
    server.sendLoggingMessage = mockSendLoggingMessage;

    wireRegistryToServer(registry, server);

    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({}, { signal: new AbortController().signal });

    const context = handler.mock.calls[0][1];
    await context.sendLog('error', 'something broke');
    expect(mockSendLoggingMessage).toHaveBeenCalledWith({
      level: 'error',
      data: 'something broke',
    });
  });

  it('should register static resources with URI string', () => {
    registry.registerResource(
      { name: 'config', uri: 'app://config', description: 'Config', mimeType: 'application/json' },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterResource).toHaveBeenCalledTimes(1);
    expect(mockRegisterResource).toHaveBeenCalledWith(
      'config',
      'app://config',
      { description: 'Config', mimeType: 'application/json' },
      expect.any(Function),
    );
  });

  it('should pass resource title and size to the server when present', () => {
    registry.registerResource(
      { name: 'db-dump', uri: 'app://db-dump', title: 'Database Dump', description: 'Full DB', size: 1048576 },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterResource.mock.calls[0][2];
    expect(config.title).toBe('Database Dump');
    expect(config.size).toBe(1048576);
  });

  it('should register template resources with ResourceTemplate and list: undefined', () => {
    registry.registerResource(
      { name: 'item', uri: 'item://{id}', isTemplate: true },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterResource).toHaveBeenCalledTimes(1);
    expect(mockRegisterResource.mock.calls[0][0]).toBe('item');
    expect(mockRegisterResource.mock.calls[0][1]).toEqual({ uri: 'item://{id}' });
  });

  it('should resolve listProvider and pass list callback to ResourceTemplate', () => {
    const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const mockList = jest.fn().mockResolvedValue([{ uri: 'item://1', name: 'Item 1' }]);

    class TestListProvider { list = mockList; }

    registry.setProviderResolver(() => new TestListProvider());
    registry.registerResource(
      { name: 'item', uri: 'item://{id}', isTemplate: true, listProvider: TestListProvider as any },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(ResourceTemplate).toHaveBeenCalledWith('item://{id}', { list: expect.any(Function) });

    // Verify the resolved callback delegates to the provider
    const listFn = ResourceTemplate.mock.calls[0][1].list;
    listFn();
    expect(mockList).toHaveBeenCalled();
  });

  it('should resolve completeProvider and create Proxy-based complete for ResourceTemplate', () => {
    const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const mockComplete = jest.fn().mockReturnValue(['item-1', 'item-2']);

    class TestCompleter { complete = mockComplete; }

    registry.setProviderResolver(() => new TestCompleter());
    registry.registerResource(
      { name: 'item', uri: 'item://{id}', isTemplate: true, completeProvider: TestCompleter as any },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(ResourceTemplate).toHaveBeenCalledTimes(1);
    const callArgs = ResourceTemplate.mock.calls[0];
    expect(callArgs[0]).toBe('item://{id}');
    expect(callArgs[1].list).toBeUndefined();
    expect(callArgs[1].complete).toBeDefined();

    // Verify the proxy routes argName through to the provider
    const complete = callArgs[1].complete;
    complete.id('item-', { arguments: {} });
    expect(mockComplete).toHaveBeenCalledWith('id', 'item-', { arguments: {} });
  });

  it('should omit complete from ResourceTemplate when completeProvider not provided', () => {
    const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');

    registry.registerResource(
      { name: 'item', uri: 'item://{id}', isTemplate: true },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(ResourceTemplate).toHaveBeenCalledWith('item://{id}', { list: undefined });
  });

  it('should pass prompt title to the server when present', () => {
    registry.registerPrompt(
      { name: 'summarize', title: 'Summarize Item', description: 'Generate a summary' },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterPrompt.mock.calls[0][1];
    expect(config.title).toBe('Summarize Item');
  });

  it('should register prompts with correct args', () => {
    const argsSchema = { itemId: z.string() };
    registry.registerPrompt(
      { name: 'summarize', description: 'Summarize', argsSchema },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterPrompt).toHaveBeenCalledTimes(1);
    expect(mockRegisterPrompt).toHaveBeenCalledWith(
      'summarize',
      { description: 'Summarize', argsSchema },
      expect.any(Function),
    );
  });

  it('should handle empty registry without errors', () => {
    expect(() => wireRegistryToServer(registry, createMockServer())).not.toThrow();
    expect(mockRegisterTool).not.toHaveBeenCalled();
    expect(mockRegisterResource).not.toHaveBeenCalled();
    expect(mockRegisterPrompt).not.toHaveBeenCalled();
  });

  it('should return an unsubscribe function', () => {
    const unsub = wireRegistryToServer(registry, createMockServer());
    expect(typeof unsub).toBe('function');
  });

  it('should dynamically wire tools registered after initial wiring', () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    expect(mockRegisterTool).not.toHaveBeenCalled();

    // Register tool after wiring — should be wired via change listener
    registry.registerTool({ name: 'late-tool', description: 'Added later' }, jest.fn());

    expect(mockRegisterTool).toHaveBeenCalledTimes(1);
    expect(mockRegisterTool).toHaveBeenCalledWith(
      'late-tool',
      expect.objectContaining({ description: 'Added later' }),
      expect.any(Function),
    );
  });

  it('should stop dynamic wiring after unsubscribe is called', () => {
    const server = createMockServer();
    const unsub = wireRegistryToServer(registry, server);

    unsub();

    registry.registerTool({ name: 'ignored-tool', description: 'Should not wire' }, jest.fn());
    expect(mockRegisterTool).not.toHaveBeenCalled();
  });

  it('should register subscribe and unsubscribe request handlers', () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      { method: 'resources/subscribe' },
      expect.any(Function),
    );
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      { method: 'resources/unsubscribe' },
      expect.any(Function),
    );
  });

  it('should track subscriptions via subscribe handler', () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    // Find the subscribe handler
    const subscribeCall = mockSetRequestHandler.mock.calls.find(
      (c: any[]) => c[0].method === 'resources/subscribe',
    );
    const subscribeHandler = subscribeCall[1];

    subscribeHandler(
      { params: { uri: 'app://config' } },
      { sessionId: 'sess-1' },
    );

    expect(registry.getResourceSubscribers('app://config').has('sess-1')).toBe(true);
  });

  it('should remove subscriptions via unsubscribe handler', () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    // Subscribe first
    registry.subscribeResource('app://config', 'sess-1');

    // Find the unsubscribe handler
    const unsubscribeCall = mockSetRequestHandler.mock.calls.find(
      (c: any[]) => c[0].method === 'resources/unsubscribe',
    );
    const unsubscribeHandler = unsubscribeCall[1];

    unsubscribeHandler(
      { params: { uri: 'app://config' } },
      { sessionId: 'sess-1' },
    );

    expect(registry.getResourceSubscribers('app://config').size).toBe(0);
  });

  it('should forward resource update notifications to server', async () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    registry.notifyResourceUpdated('app://config');

    // Give the async handler time to execute
    await new Promise((r) => setTimeout(r, 10));

    expect(server.server.sendResourceUpdated).toHaveBeenCalledWith({ uri: 'app://config' });
  });

  it('should stop forwarding resource updates after unsubscribe', async () => {
    const server = createMockServer();
    const unsub = wireRegistryToServer(registry, server);

    unsub();

    registry.notifyResourceUpdated('app://config');
    await new Promise((r) => setTimeout(r, 10));

    expect(server.server.sendResourceUpdated).not.toHaveBeenCalled();
  });

  it('should enable tool enable/disable via registry.setToolEnabled', () => {
    registry.registerTool({ name: 'toggleable', description: 'Can be toggled' }, jest.fn());
    wireRegistryToServer(registry, createMockServer());

    registry.setToolEnabled('toggleable', false);
    expect(mockDisable).toHaveBeenCalledTimes(1);

    registry.setToolEnabled('toggleable', true);
    expect(mockEnable).toHaveBeenCalledTimes(1);
  });

  it('should pass icons to tool config when present', () => {
    const icons = [{ url: 'https://example.com/icon.svg', mediaType: 'image/svg+xml' }];
    registry.registerTool(
      { name: 'icon-tool', description: 'Has icons', icons },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config.icons).toEqual(icons);
  });

  it('should omit icons from tool config when not present', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config).not.toHaveProperty('icons');
  });

  it('should pass icons and annotations to resource config when present', () => {
    const icons = [{ url: 'https://example.com/res.png' }];
    const annotations = { audience: ['user' as const], priority: 0.8 };
    registry.registerResource(
      { name: 'annotated', uri: 'app://annotated', icons, annotations },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterResource.mock.calls[0][2];
    expect(config.icons).toEqual(icons);
    expect(config.annotations).toEqual(annotations);
  });

  it('should pass icons to prompt config when present', () => {
    const icons = [{ url: 'https://example.com/prompt.png' }];
    registry.registerPrompt(
      { name: 'icon-prompt', description: 'Has icons', icons },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterPrompt.mock.calls[0][1];
    expect(config.icons).toEqual(icons);
  });

  it('should resolve prompt completeProvider and create Proxy-based complete config', () => {
    const mockComplete = jest.fn().mockReturnValue(['typescript', 'python']);

    class TestCompleter { complete = mockComplete; }

    registry.setProviderResolver(() => new TestCompleter());
    registry.registerPrompt(
      {
        name: 'code-prompt',
        description: 'Generate code',
        completeProvider: TestCompleter as any,
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterPrompt.mock.calls[0][1];
    expect(config.complete).toBeDefined();
    config.complete.language('type');
    expect(mockComplete).toHaveBeenCalledWith('language', 'type', undefined);
  });

  it('should omit complete from prompt config when completeProvider not provided', () => {
    registry.registerPrompt(
      { name: 'simple-prompt', description: 'No completions' },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterPrompt.mock.calls[0][1];
    expect(config).not.toHaveProperty('complete');
  });

  it('should log a warning when subscribe request has no sessionId', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    const subscribeCall = mockSetRequestHandler.mock.calls.find(
      (c: any[]) => c[0].method === 'resources/subscribe',
    );
    const subscribeHandler = subscribeCall[1];

    subscribeHandler(
      { params: { uri: 'app://config' } },
      { /* no sessionId */ },
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Subscribe request for "app://config" has no sessionId'),
    );
    expect(registry.getResourceSubscribers('app://config').size).toBe(0);
    warnSpy.mockRestore();
  });

  it('should log a warning when unsubscribe request has no sessionId', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    registry.subscribeResource('app://config', 'sess-1');

    const unsubscribeCall = mockSetRequestHandler.mock.calls.find(
      (c: any[]) => c[0].method === 'resources/unsubscribe',
    );
    const unsubscribeHandler = unsubscribeCall[1];

    unsubscribeHandler(
      { params: { uri: 'app://config' } },
      { /* no sessionId */ },
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Unsubscribe request for "app://config" has no sessionId'),
    );
    // Subscription should still be intact since removal couldn't happen
    expect(registry.getResourceSubscribers('app://config').has('sess-1')).toBe(true);
    warnSpy.mockRestore();
  });
});
