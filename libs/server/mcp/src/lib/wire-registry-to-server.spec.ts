import { Logger } from '@nestjs/common';
import { McpToolRegistry } from './mcp-tool-registry';
import { buildCapabilities } from './build-capabilities';
import { wireRegistryToServer } from './wire-registry-to-server';
import { z } from 'zod';
import { completable, isCompletable } from '@modelcontextprotocol/server';

const mockEnable = jest.fn();
const mockDisable = jest.fn();
const mockRegisterTool = jest
  .fn()
  .mockReturnValue({ enable: mockEnable, disable: mockDisable });
const mockRegisterResource = jest.fn();
const mockRegisterPrompt = jest.fn();
const mockSetRequestHandler = jest.fn();
const mockSendResourceUpdated = jest.fn().mockResolvedValue(undefined);

jest.mock('@modelcontextprotocol/server', () => ({
  ...jest.requireActual('@modelcontextprotocol/server'),
  McpServer: jest.fn(),
  ResourceTemplate: jest.fn().mockImplementation((uri: string) => ({ uri })),
}));

function createMockServer() {
  return {
    isConnected: jest.fn().mockReturnValue(false),
    registerTool: mockRegisterTool,
    registerResource: mockRegisterResource,
    registerPrompt: mockRegisterPrompt,
    sendLoggingMessage: jest.fn().mockResolvedValue(undefined),
    server: {
      setRequestHandler: mockSetRequestHandler,
      registerCapabilities: jest.fn(),
      getClientCapabilities: jest.fn().mockReturnValue({}),
      sendResourceUpdated: mockSendResourceUpdated,
      notification: jest.fn().mockResolvedValue(undefined),
      createMessage: jest.fn().mockResolvedValue({}),
      elicitInput: jest.fn().mockResolvedValue({}),
      listRoots: jest.fn().mockResolvedValue({ roots: [] }),
    },
  } as any;
}

/** The completer `completable()` attached (the SDK keeps its own getter internal). */
function getCompleter(schema: unknown): ((...args: any[]) => any) | undefined {
  return (schema as any)?.[Symbol.for('mcp.completable')]?.complete;
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
    expect(buildCapabilities(registry, { logging: true })).toEqual({
      logging: {},
    });
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
    registry.registerTool(
      { name: 'my-tool', description: 'A tool', schema },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterTool).toHaveBeenCalledTimes(1);
    const [name, config] = mockRegisterTool.mock.calls[0];
    expect(name).toBe('my-tool');
    expect(config.description).toBe('A tool');
    // Advertised with the tool's own JSON Schema, but validated by the registry.
    const standard = config.inputSchema['~standard'];
    expect(standard.jsonSchema).toBe((schema as any)['~standard'].jsonSchema);
    expect(standard.validate({ text: 42 })).toEqual({ value: { text: 42 } });
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
      {
        name: 'structured-tool',
        description: 'Returns structured',
        outputSchema,
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config.outputSchema).toBe(outputSchema);
  });

  it('should pass tool _meta to the server when present', () => {
    const _meta = { ui: { resourceUri: 'ui://app/view.html' } };
    registry.registerTool(
      { name: 'app-tool', description: 'Has a view', _meta },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config._meta).toEqual(_meta);
  });

  it('should omit tool _meta when not present', () => {
    registry.registerTool({ name: 'tool', description: 'd' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterTool.mock.calls[0][1];
    expect(config).not.toHaveProperty('_meta');
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

  /** A v2 handler context with the fields the wiring reads. */
  function ctxOf(overrides: Record<string, any> = {}) {
    const { authInfo, sessionId, signal, _meta, notify, log, ...mcpReq } =
      overrides;
    return {
      sessionId,
      http: authInfo ? { authInfo } : undefined,
      mcpReq: {
        id: 1,
        method: 'tools/call',
        signal: signal ?? new AbortController().signal,
        _meta,
        notify: notify ?? jest.fn().mockResolvedValue(undefined),
        log: log ?? jest.fn().mockResolvedValue(undefined),
        ...mcpReq,
      },
    };
  }

  it('should forward authInfo from the SDK context', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    const mockAuthInfo = { token: 'abc', clientId: 'c1', scopes: ['read'] };
    await callback({ text: 'hi' }, ctxOf({ authInfo: mockAuthInfo }));

    expect(handler).toHaveBeenCalledWith(
      { text: 'hi' },
      expect.objectContaining({ authInfo: mockAuthInfo }),
    );
  });

  it('should forward era, sessionId, signal and input responses from the SDK context', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    const abortController = new AbortController();
    const requestState = jest.fn().mockReturnValue('state');
    await callback(
      { text: 'hi' },
      ctxOf({
        sessionId: 'sess-42',
        signal: abortController.signal,
        inputResponses: { confirm: { action: 'accept' } },
        requestState,
      }),
    );

    const context = handler.mock.calls[0][1];
    expect(context).toEqual(
      expect.objectContaining({
        era: 'legacy',
        sessionId: 'sess-42',
        signal: abortController.signal,
        inputResponses: { confirm: { action: 'accept' } },
      }),
    );
    expect(context.requestState()).toBe('state');
  });

  it("should send progress on the request's own channel when the request has a progressToken", async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const notify = jest.fn().mockResolvedValue(undefined);
    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({}, ctxOf({ _meta: { progressToken: 'tok-1' }, notify }));

    const context = handler.mock.calls[0][1];
    await context.sendProgress(50, 100, 'halfway');
    expect(notify).toHaveBeenCalledWith({
      method: 'notifications/progress',
      params: {
        progressToken: 'tok-1',
        progress: 50,
        total: 100,
        message: 'halfway',
      },
    });
  });

  it('should not provide sendProgress when the request has no progressToken', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({}, ctxOf());

    expect(handler.mock.calls[0][1].sendProgress).toBeUndefined();
  });

  it("should log through the SDK, which applies the client's level", async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer());

    const log = jest.fn().mockResolvedValue(undefined);
    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({}, ctxOf({ log }));

    const context = handler.mock.calls[0][1];
    await context.sendLog('info', { message: 'test' }, 'my-tool');
    await context.sendLog('error', 'something broke');
    expect(log.mock.calls).toEqual([
      ['info', { message: 'test' }, 'my-tool'],
      ['error', 'something broke', undefined],
    ]);
  });

  it('should leave out progress and logging when the transport drops request-scoped messages', async () => {
    const handler = jest.fn().mockResolvedValue('result');
    registry.registerTool({ name: 'tool', description: 'd' }, handler);

    wireRegistryToServer(registry, createMockServer(), {
      requestScopedMessages: false,
    });

    const callback = mockRegisterTool.mock.calls[0][2];
    await callback({}, ctxOf({ _meta: { progressToken: 't' } }));

    const context = handler.mock.calls[0][1];
    expect(context.sendProgress).toBeUndefined();
    expect(context.sendLog).toBeUndefined();
  });

  it('should register static resources with URI string', () => {
    registry.registerResource(
      {
        name: 'config',
        uri: 'app://config',
        description: 'Config',
        mimeType: 'application/json',
      },
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
      {
        name: 'db-dump',
        uri: 'app://db-dump',
        title: 'Database Dump',
        description: 'Full DB',
        size: 1048576,
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterResource.mock.calls[0][2];
    expect(config.title).toBe('Database Dump');
    expect(config.size).toBe(1048576);
  });

  it('should pass resource _meta to the server when present', () => {
    const _meta = { ui: { prefersBorder: true } };
    registry.registerResource(
      {
        name: 'view',
        uri: 'ui://app/view.html',
        mimeType: 'text/html;profile=mcp-app',
        _meta,
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterResource.mock.calls[0][2];
    expect(config._meta).toEqual(_meta);
  });

  it('should omit resource _meta when not present', () => {
    registry.registerResource({ name: 'plain', uri: 'app://plain' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterResource.mock.calls[0][2];
    expect(config).not.toHaveProperty('_meta');
  });

  it('should register template resources with ResourceTemplate and list: undefined', () => {
    registry.registerResource(
      { name: 'item', uri: 'item://{id}', isTemplate: true },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterResource).toHaveBeenCalledTimes(1);
    expect(mockRegisterResource.mock.calls[0][0]).toBe('item');
    expect(mockRegisterResource.mock.calls[0][1]).toEqual({
      uri: 'item://{id}',
    });
  });

  it("should give each listed resource without _meta its own copy of the template's", async () => {
    const { ResourceTemplate } = require('@modelcontextprotocol/server');
    class TestListProvider {
      list = async () => ({
        resources: [
          { uri: 'item://1', name: 'Item 1' },
          { uri: 'item://2', name: 'Item 2', _meta: undefined },
          { uri: 'item://3', name: 'Item 3', _meta: { own: true } },
        ],
      });
    }
    registry.setProviderResolver(() => new TestListProvider());
    registry.registerResource(
      {
        name: 'item',
        uri: 'item://{id}',
        isTemplate: true,
        listStrategy: TestListProvider as any,
        _meta: { shared: { nested: true } },
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());
    const listed = await ResourceTemplate.mock.calls[0][1].list();

    expect(listed.resources.map((r: any) => r._meta)).toEqual([
      { shared: { nested: true } },
      { shared: { nested: true } },
      { own: true },
    ]);
    // Copies, so changing one resource's _meta changes no other.
    expect(listed.resources[0]._meta).not.toBe(listed.resources[1]._meta);
    expect(listed.resources[0]._meta.shared).not.toBe(
      listed.resources[1]._meta.shared,
    );
  });

  it('should warn once about _meta keys under a reserved prefix, and still pass them', () => {
    const warn = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
    registry.registerTool(
      {
        name: 'reserved-meta',
        description: 'd',
        _meta: { 'io.modelcontextprotocol/related': 1, 'acme.com/x': 2 },
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());
    wireRegistryToServer(registry, createMockServer());

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('io.modelcontextprotocol/related');
    expect(warn.mock.calls[0][0]).not.toContain('acme.com/x');
    expect(mockRegisterTool.mock.calls[0][1]._meta).toEqual({
      'io.modelcontextprotocol/related': 1,
      'acme.com/x': 2,
    });
    warn.mockRestore();
  });

  it('should resolve listStrategy and pass list callback to ResourceTemplate', () => {
    const { ResourceTemplate } = require('@modelcontextprotocol/server');
    const mockList = jest
      .fn()
      .mockResolvedValue([{ uri: 'item://1', name: 'Item 1' }]);

    class TestListProvider {
      list = mockList;
    }

    registry.setProviderResolver(() => new TestListProvider());
    registry.registerResource(
      {
        name: 'item',
        uri: 'item://{id}',
        isTemplate: true,
        listStrategy: TestListProvider as any,
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(ResourceTemplate).toHaveBeenCalledWith('item://{id}', {
      list: expect.any(Function),
    });

    // Verify the resolved callback delegates to the provider
    const listFn = ResourceTemplate.mock.calls[0][1].list;
    listFn();
    expect(mockList).toHaveBeenCalled();
  });

  it('should resolve completeStrategy and create Proxy-based complete for ResourceTemplate', () => {
    const { ResourceTemplate } = require('@modelcontextprotocol/server');
    const mockComplete = jest.fn().mockReturnValue(['item-1', 'item-2']);

    class TestCompleter {
      complete = mockComplete;
    }

    registry.setProviderResolver(() => new TestCompleter());
    registry.registerResource(
      {
        name: 'item',
        uri: 'item://{id}',
        isTemplate: true,
        completeStrategy: TestCompleter as any,
      },
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

  it('should omit complete from ResourceTemplate when completeStrategy not provided', () => {
    const { ResourceTemplate } = require('@modelcontextprotocol/server');

    registry.registerResource(
      { name: 'item', uri: 'item://{id}', isTemplate: true },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(ResourceTemplate).toHaveBeenCalledWith('item://{id}', {
      list: undefined,
    });
  });

  it('should pass prompt title to the server when present', () => {
    registry.registerPrompt(
      {
        name: 'summarize',
        title: 'Summarize Item',
        description: 'Generate a summary',
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterPrompt.mock.calls[0][1];
    expect(config.title).toBe('Summarize Item');
  });

  it('should pass prompt _meta to the server when present, and omit it when not', () => {
    registry.registerPrompt(
      { name: 'with-meta', description: 'd', _meta: { 'acme/kind': 'report' } },
      jest.fn(),
    );
    registry.registerPrompt({ name: 'plain', description: 'd' }, jest.fn());

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterPrompt.mock.calls[0][1]._meta).toEqual({
      'acme/kind': 'report',
    });
    expect(mockRegisterPrompt.mock.calls[1][1]).not.toHaveProperty('_meta');
  });

  it('should register prompts with correct args', () => {
    const argsSchema = { itemId: z.string() };
    registry.registerPrompt(
      { name: 'summarize', description: 'Summarize', argsSchema },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterPrompt).toHaveBeenCalledTimes(1);
    const [name, config] = mockRegisterPrompt.mock.calls[0];
    expect(name).toBe('summarize');
    expect(config.description).toBe('Summarize');
    // The argument shape, as the object schema the SDK takes.
    expect(config.argsSchema.shape).toEqual(argsSchema);
  });

  it('should handle empty registry without errors', () => {
    expect(() =>
      wireRegistryToServer(registry, createMockServer()),
    ).not.toThrow();
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
    registry.registerTool(
      { name: 'late-tool', description: 'Added later' },
      jest.fn(),
    );

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

    registry.registerTool(
      { name: 'ignored-tool', description: 'Should not wire' },
      jest.fn(),
    );
    expect(mockRegisterTool).not.toHaveBeenCalled();
  });

  it('should register subscribe and unsubscribe request handlers', () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    // `logging/setLevel` is the SDK's own, installed with the `logging` capability.
    expect(mockSetRequestHandler).toHaveBeenCalledTimes(2);
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      'resources/subscribe',
      expect.any(Function),
    );
    expect(mockSetRequestHandler).toHaveBeenCalledWith(
      'resources/unsubscribe',
      expect.any(Function),
    );
  });

  it('should not handle subscriptions or advertise list changes without a stream for them (stateless HTTP)', () => {
    registry.registerTool({ name: 't', description: 'd' }, jest.fn());
    registry.registerResource({ name: 'r', uri: 'app://r' }, jest.fn());
    registry.registerPrompt({ name: 'p', description: 'd' }, jest.fn());
    const server = createMockServer();
    wireRegistryToServer(registry, server, { unsolicitedMessages: false });

    expect(mockSetRequestHandler).not.toHaveBeenCalledWith(
      'resources/subscribe',
      expect.any(Function),
    );
    expect(server.server.registerCapabilities).toHaveBeenCalledWith({
      tools: { listChanged: false },
      resources: { subscribe: false, listChanged: false },
      prompts: { listChanged: false },
    });
  });

  it('should leave capabilities alone on a server that is already connected', () => {
    registry.registerTool({ name: 't', description: 'd' }, jest.fn());
    const server = createMockServer();
    server.isConnected.mockReturnValue(true);
    wireRegistryToServer(registry, server, { unsolicitedMessages: false });

    expect(server.server.registerCapabilities).not.toHaveBeenCalled();
  });

  it('should track subscriptions via subscribe handler', () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    // Find the subscribe handler
    const subscribeCall = mockSetRequestHandler.mock.calls.find(
      (c: any[]) => c[0] === 'resources/subscribe',
    );
    const subscribeHandler = subscribeCall[1];

    subscribeHandler(
      { params: { uri: 'app://config' } },
      { sessionId: 'sess-1' },
    );

    expect(registry.getResourceSubscribers('app://config').has('sess-1')).toBe(
      true,
    );
  });

  it('should remove subscriptions via unsubscribe handler', () => {
    const server = createMockServer();
    wireRegistryToServer(registry, server);

    // Subscribe first
    registry.subscribeResource('app://config', 'sess-1');

    // Find the unsubscribe handler
    const unsubscribeCall = mockSetRequestHandler.mock.calls.find(
      (c: any[]) => c[0] === 'resources/unsubscribe',
    );
    const unsubscribeHandler = unsubscribeCall[1];

    unsubscribeHandler(
      { params: { uri: 'app://config' } },
      { sessionId: 'sess-1' },
    );

    expect(registry.getResourceSubscribers('app://config').size).toBe(0);
  });

  function serverWithOwnHandlers() {
    const server = createMockServer();
    server.server.setRequestHandler = jest.fn();
    server.server.sendResourceUpdated = jest.fn().mockResolvedValue(undefined);
    const handler = (method: string) =>
      server.server.setRequestHandler.mock.calls.find(
        (c: any[]) => c[0] === method,
      )[1];
    return { server, handler };
  }

  it('should forward resource updates only to servers whose client subscribed to the URI', async () => {
    const a = serverWithOwnHandlers();
    const b = serverWithOwnHandlers();
    wireRegistryToServer(registry, a.server);
    wireRegistryToServer(registry, b.server);

    a.handler('resources/subscribe')(
      { params: { uri: 'app://config' } },
      { sessionId: 'sess-a' },
    );

    registry.notifyResourceUpdated('app://config');
    registry.notifyResourceUpdated('app://other');
    await new Promise((r) => setTimeout(r, 10));

    expect(a.server.server.sendResourceUpdated).toHaveBeenCalledTimes(1);
    expect(a.server.server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: 'app://config',
    });
    expect(b.server.server.sendResourceUpdated).not.toHaveBeenCalled();
  });

  it('should forward resource updates to a subscribed client without a session ID (e.g. stdio)', async () => {
    const warnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const a = serverWithOwnHandlers();
    wireRegistryToServer(registry, a.server);

    a.handler('resources/subscribe')({ params: { uri: 'app://config' } }, {});
    registry.notifyResourceUpdated('app://config');
    await new Promise((r) => setTimeout(r, 10));

    expect(a.server.server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: 'app://config',
    });
    warnSpy.mockRestore();
  });

  it('should stop forwarding resource updates after the client unsubscribes', async () => {
    const a = serverWithOwnHandlers();
    wireRegistryToServer(registry, a.server);

    a.handler('resources/subscribe')(
      { params: { uri: 'app://config' } },
      { sessionId: 'sess-a' },
    );
    a.handler('resources/unsubscribe')(
      { params: { uri: 'app://config' } },
      { sessionId: 'sess-a' },
    );
    registry.notifyResourceUpdated('app://config');
    await new Promise((r) => setTimeout(r, 10));

    expect(a.server.server.sendResourceUpdated).not.toHaveBeenCalled();
  });

  it('should forward resource update notifications to server', async () => {
    const { server, handler } = serverWithOwnHandlers();
    wireRegistryToServer(registry, server);
    handler('resources/subscribe')(
      { params: { uri: 'app://config' } },
      { sessionId: 'sess-1' },
    );

    registry.notifyResourceUpdated('app://config');

    // Give the async handler time to execute
    await new Promise((r) => setTimeout(r, 10));

    expect(server.server.sendResourceUpdated).toHaveBeenCalledWith({
      uri: 'app://config',
    });
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
    registry.registerTool(
      { name: 'toggleable', description: 'Can be toggled' },
      jest.fn(),
    );
    wireRegistryToServer(registry, createMockServer());

    registry.setToolEnabled('toggleable', false);
    expect(mockDisable).toHaveBeenCalledTimes(1);

    registry.setToolEnabled('toggleable', true);
    expect(mockEnable).toHaveBeenCalledTimes(1);
  });

  function toolServer() {
    const server = createMockServer();
    const enable = jest.fn();
    const disable = jest.fn();
    server.registerTool = jest.fn().mockReturnValue({ enable, disable });
    return { server, enable, disable };
  }

  it('should apply setToolEnabled to every wired server, not just the newest', () => {
    registry.registerTool(
      { name: 'toggleable', description: 'Can be toggled' },
      jest.fn(),
    );
    const a = toolServer();
    const b = toolServer();
    wireRegistryToServer(registry, a.server);
    wireRegistryToServer(registry, b.server);

    registry.setToolEnabled('toggleable', false);

    expect(a.disable).toHaveBeenCalledTimes(1);
    expect(b.disable).toHaveBeenCalledTimes(1);
  });

  it('should start servers wired later with tools disabled by setToolEnabled', () => {
    registry.registerTool(
      { name: 'toggleable', description: 'Can be toggled' },
      jest.fn(),
    );
    const unwire = wireRegistryToServer(registry, toolServer().server);
    registry.setToolEnabled('toggleable', false);
    unwire();

    const later = toolServer();
    wireRegistryToServer(registry, later.server);
    expect(later.disable).toHaveBeenCalledTimes(1);

    registry.setToolEnabled('toggleable', true);
    const latest = toolServer();
    wireRegistryToServer(registry, latest.server);
    expect(later.enable).toHaveBeenCalledTimes(1);
    expect(latest.disable).not.toHaveBeenCalled();
  });

  it('should stop toggling a server after it is unwired', () => {
    registry.registerTool(
      { name: 'toggleable', description: 'Can be toggled' },
      jest.fn(),
    );
    const a = toolServer();
    const unwire = wireRegistryToServer(registry, a.server);
    unwire();

    registry.setToolEnabled('toggleable', false);
    expect(a.disable).not.toHaveBeenCalled();
  });

  it('should pass icons to tool config when present', () => {
    const icons = [
      { src: 'https://example.com/icon.svg', mimeType: 'image/svg+xml' },
    ];
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
    const icons = [{ src: 'https://example.com/res.png' }];
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
    const icons = [{ src: 'https://example.com/prompt.png' }];
    registry.registerPrompt(
      { name: 'icon-prompt', description: 'Has icons', icons },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterPrompt.mock.calls[0][1];
    expect(config.icons).toEqual(icons);
  });

  it('should attach the prompt completeStrategy to each argument the way the SDK reads it', async () => {
    const mockComplete = jest.fn().mockReturnValue(['typescript', 'python']);

    class TestCompleter {
      complete = mockComplete;
    }

    const language = z.string();
    registry.setProviderResolver(() => new TestCompleter());
    registry.registerPrompt(
      {
        name: 'code-prompt',
        description: 'Generate code',
        argsSchema: { language, task: z.string() },
        completeStrategy: TestCompleter as any,
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());
    wireRegistryToServer(registry, createMockServer());

    const config = mockRegisterPrompt.mock.calls[0][1];
    expect(config).not.toHaveProperty('complete');
    expect(isCompletable(config.argsSchema.shape.language)).toBe(true);
    expect(isCompletable(config.argsSchema.shape.task)).toBe(true);
    // The author's schema is left unmarked, and a second server reuses the same copy.
    expect(isCompletable(language)).toBe(false);
    expect(mockRegisterPrompt.mock.calls[1][1].argsSchema.shape.language).toBe(
      config.argsSchema.shape.language,
    );

    const complete = getCompleter(config.argsSchema.shape.language)!;
    await expect(
      Promise.resolve(complete('type', { arguments: { task: 'x' } })),
    ).resolves.toEqual(['typescript', 'python']);
    expect(mockComplete).toHaveBeenCalledWith('language', 'type', {
      arguments: { task: 'x' },
    });
  });

  it('should keep a completer the author attached to an argument', () => {
    class TestCompleter {
      complete = jest.fn();
    }
    const own = completable(z.string(), () => ['mine']);
    registry.setProviderResolver(() => new TestCompleter());
    registry.registerPrompt(
      {
        name: 'own-prompt',
        argsSchema: { own },
        completeStrategy: TestCompleter as any,
      },
      jest.fn(),
    );

    wireRegistryToServer(registry, createMockServer());

    expect(mockRegisterPrompt.mock.calls[0][1].argsSchema.shape.own).toBe(own);
  });

  it('should omit complete from prompt config when completeStrategy not provided', () => {
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
      (c: any[]) => c[0] === 'resources/subscribe',
    );
    const subscribeHandler = subscribeCall[1];

    subscribeHandler(
      { params: { uri: 'app://config' } },
      {
        /* no sessionId */
      },
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Subscribe request for "app://config" has no sessionId',
      ),
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
      (c: any[]) => c[0] === 'resources/unsubscribe',
    );
    const unsubscribeHandler = unsubscribeCall[1];

    unsubscribeHandler(
      { params: { uri: 'app://config' } },
      {
        /* no sessionId */
      },
    );

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        'Unsubscribe request for "app://config" has no sessionId',
      ),
    );
    // Subscription should still be intact since removal couldn't happen
    expect(registry.getResourceSubscribers('app://config').has('sess-1')).toBe(
      true,
    );
    warnSpy.mockRestore();
  });

  describe('resource auto-wrapping', () => {
    it('should auto-wrap string resource handler return value', async () => {
      registry.registerResource(
        { name: 'text-res', uri: 'app://text' },
        jest.fn().mockResolvedValue('hello world'),
      );

      wireRegistryToServer(registry, createMockServer());

      const callback = mockRegisterResource.mock.calls[0][3];
      const result = await callback(new URL('app://text'), {});
      expect(result).toEqual({
        contents: [
          { uri: 'app://text', mimeType: 'text/plain', text: 'hello world' },
        ],
      });
    });

    it('should auto-wrap object resource handler return value', async () => {
      registry.registerResource(
        { name: 'json-res', uri: 'app://json' },
        jest.fn().mockResolvedValue({ key: 'value' }),
      );

      wireRegistryToServer(registry, createMockServer());

      const callback = mockRegisterResource.mock.calls[0][3];
      const result = await callback(new URL('app://json'), {});
      expect(result.contents).toHaveLength(1);
      expect(result.contents[0].uri).toBe('app://json');
      expect(result.contents[0].mimeType).toBe('application/json');
      expect(JSON.parse(result.contents[0].text)).toEqual({ key: 'value' });
    });

    it('should pass through resource handler returning contents array', async () => {
      const fullResult = {
        contents: [{ uri: 'app://data', text: 'existing' }],
      };
      registry.registerResource(
        { name: 'full-res', uri: 'app://data' },
        jest.fn().mockResolvedValue(fullResult),
      );

      wireRegistryToServer(registry, createMockServer());

      const callback = mockRegisterResource.mock.calls[0][3];
      const result = await callback(new URL('app://data'), {});
      expect(result).toEqual(fullResult);
    });

    it('should use metadata mimeType for auto-wrapped resource results', async () => {
      registry.registerResource(
        { name: 'csv-res', uri: 'app://csv', mimeType: 'text/csv' },
        jest.fn().mockResolvedValue('a,b,c'),
      );

      wireRegistryToServer(registry, createMockServer());

      const callback = mockRegisterResource.mock.calls[0][3];
      const result = await callback(new URL('app://csv'), {});
      expect(result.contents[0].mimeType).toBe('text/csv');
    });

    it('should auto-wrap template resource handler return value', async () => {
      registry.registerResource(
        { name: 'item', uri: 'item://{id}', isTemplate: true },
        jest.fn().mockResolvedValue('item data'),
      );

      wireRegistryToServer(registry, createMockServer());

      const callback = mockRegisterResource.mock.calls[0][3];
      const result = await callback(new URL('item://123'), { id: '123' }, {});
      expect(result).toEqual({
        contents: [
          { uri: 'item://123', mimeType: 'text/plain', text: 'item data' },
        ],
      });
    });
  });

  describe('prompt auto-wrapping', () => {
    it('should auto-wrap string prompt handler return value', async () => {
      registry.registerPrompt(
        { name: 'text-prompt', description: 'Returns text' },
        jest.fn().mockResolvedValue('Generate a summary'),
      );

      wireRegistryToServer(registry, createMockServer());

      const callback = mockRegisterPrompt.mock.calls[0][2];
      const result = await callback({});
      expect(result).toEqual({
        messages: [
          {
            role: 'user',
            content: { type: 'text', text: 'Generate a summary' },
          },
        ],
      });
    });

    it('should auto-wrap object prompt handler return value', async () => {
      registry.registerPrompt(
        { name: 'obj-prompt', description: 'Returns object' },
        jest.fn().mockResolvedValue({ topic: 'testing' }),
      );

      wireRegistryToServer(registry, createMockServer());

      const callback = mockRegisterPrompt.mock.calls[0][2];
      const result = await callback({});
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(result.messages[0].content.type).toBe('text');
      expect(JSON.parse(result.messages[0].content.text)).toEqual({
        topic: 'testing',
      });
    });

    it('should pass through prompt handler returning messages array', async () => {
      const fullResult = {
        messages: [
          { role: 'user', content: { type: 'text', text: 'existing' } },
        ],
      };
      registry.registerPrompt(
        { name: 'full-prompt', description: 'Returns full shape' },
        jest.fn().mockResolvedValue(fullResult),
      );

      wireRegistryToServer(registry, createMockServer());

      const callback = mockRegisterPrompt.mock.calls[0][2];
      const result = await callback({});
      expect(result).toEqual(fullResult);
    });
  });
});
