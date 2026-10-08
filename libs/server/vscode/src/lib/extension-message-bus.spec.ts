import {
  createExtensionMessageBus,
  ExtensionMessageBus,
} from './extension-message-bus';

function setup(
  options: {
    registry?: Record<string, (p: unknown) => unknown> | null;
    config?: { requestTimeoutMs?: number; debug?: boolean };
  } = {},
) {
  const serverUnsubs: jest.Mock[] = [];
  const server = {
    sendRequest: jest.fn().mockResolvedValue('server-result'),
    onNotification: jest.fn(() => {
      const unsub = jest.fn();
      serverUnsubs.push(unsub);
      return unsub;
    }),
  };
  let onMessage: (message: unknown) => void = () => undefined;
  const webview = {
    postMessage: jest.fn(),
    onMessage: jest.fn((cb: (message: unknown) => void) => {
      onMessage = cb;
    }),
  };
  const handlers = options.registry;
  const registry =
    handlers === null || handlers === undefined
      ? null
      : {
          getHandler: (m: string) => handlers[m],
          hasHandler: (m: string) => m in handlers,
          getRegisteredMethods: () => Object.keys(handlers),
        };
  const bus = createExtensionMessageBus(
    server as never,
    webview as never,
    registry as never,
    options.config,
  );
  return {
    bus,
    server,
    webview,
    serverUnsubs,
    receive: (message: unknown) => onMessage(message),
    lastPosted: () =>
      webview.postMessage.mock.calls[
        webview.postMessage.mock.calls.length - 1
      ][0],
  };
}

const flush = () => new Promise((r) => setImmediate(r));

describe(ExtensionMessageBus.name, () => {
  beforeEach(() => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('subscribes to webview messages on construction', () => {
    const { webview } = setup();
    expect(webview.onMessage).toHaveBeenCalledTimes(1);
  });

  it('createExtensionMessageBus works with defaults', () => {
    const bus = createExtensionMessageBus(
      { sendRequest: jest.fn() } as never,
      { onMessage: jest.fn() } as never,
    );
    expect(bus).toBeInstanceOf(ExtensionMessageBus);
    expect(bus.getRegisteredHandlers()).toEqual([]);
  });

  describe('sendRequest', () => {
    it('routes server.* requests to the server with the default timeout', async () => {
      const { bus, server } = setup();
      await expect(bus.sendRequest('server.doIt', { a: 1 })).resolves.toBe(
        'server-result',
      );
      expect(server.sendRequest).toHaveBeenCalledWith('doIt', { a: 1 }, 30000);
    });

    it('honours per-call and configured timeouts', async () => {
      const { bus, server } = setup({ config: { requestTimeoutMs: 5 } });
      await bus.sendRequest('server.a');
      await bus.sendRequest('server.b', undefined, { timeoutMs: 9 });
      expect(server.sendRequest.mock.calls).toEqual([
        ['a', undefined, 5],
        ['b', undefined, 9],
      ]);
    });

    it('routes extension.* requests to local handlers', async () => {
      const { bus, server } = setup();
      bus.registerHandler('calc', async (p: { n: number }) => p.n * 2);
      await expect(bus.sendRequest('extension.calc', { n: 4 })).resolves.toBe(
        8,
      );
      expect(server.sendRequest).not.toHaveBeenCalled();
    });

    it('falls back to the WebviewHandlerRegistry for local requests', async () => {
      const { bus } = setup({ registry: { fromRegistry: () => 'reg' } });
      await expect(bus.sendRequest('extension.fromRegistry')).resolves.toBe(
        'reg',
      );
    });

    it('rejects extension.* requests with no handler', async () => {
      const { bus } = setup({ registry: {} });
      await expect(bus.sendRequest('extension.missing')).rejects.toThrow(
        'No handler registered for method: missing',
      );
    });

    it('sends webview.* requests to the webview and resolves on response', async () => {
      const { bus, webview } = setup();
      const pending = bus.sendRequest('webview.getState', { k: 1 });

      const request = webview.postMessage.mock.calls[0][0];
      expect(request).toEqual({
        jsonrpc: '2.0',
        id: expect.stringMatching(/^ext-1-\d+$/),
        method: 'getState',
        params: { k: 1 },
      });

      await bus.handleWebviewMessage({
        jsonrpc: '2.0',
        id: request.id,
        result: 'st',
      } as never);
      await expect(pending).resolves.toBe('st');
    });

    it('resolves webview requests from responses posted through onMessage', async () => {
      const { bus, webview, receive } = setup();
      const pending = bus.sendRequest('webview.getState');
      const { id } = webview.postMessage.mock.calls[0][0];
      receive({ jsonrpc: '2.0', id, result: 'st' });
      await expect(pending).resolves.toBe('st');
      expect(webview.postMessage).toHaveBeenCalledTimes(1);
    });

    it('rejects webview requests from error responses posted through onMessage', async () => {
      const { bus, webview, receive } = setup();
      const pending = bus.sendRequest('webview.fail');
      const { id } = webview.postMessage.mock.calls[0][0];
      receive({ jsonrpc: '2.0', id, error: { code: -32601, message: 'nope' } });
      await expect(pending).rejects.toThrow('nope');
    });

    it('resolves with undefined when the webview response has no result', async () => {
      const { bus, webview, receive } = setup();
      const pending = bus.sendRequest('webview.fireAndAck');
      const { id } = webview.postMessage.mock.calls[0][0];
      receive({ jsonrpc: '2.0', id });
      await expect(pending).resolves.toBeUndefined();
    });

    it('rejects webview requests when the webview responds with an error', async () => {
      const { bus, webview } = setup();
      const pending = bus.sendRequest('webview.fail');
      const { id } = webview.postMessage.mock.calls[0][0];

      await bus.handleWebviewMessage({
        jsonrpc: '2.0',
        id,
        error: { code: 1, message: 'nope' },
      } as never);

      await expect(pending).rejects.toThrow('nope');
    });

    it('uses "Unknown error" when the webview error has no message', async () => {
      const { bus, webview } = setup();
      const pending = bus.sendRequest('webview.fail');
      const { id } = webview.postMessage.mock.calls[0][0];

      await bus.handleWebviewMessage({
        jsonrpc: '2.0',
        id,
        error: { code: 1 },
      } as never);

      await expect(pending).rejects.toThrow('Unknown error');
    });

    it('ignores responses for unknown request ids', async () => {
      const { bus, webview } = setup();
      await bus.handleWebviewMessage({
        jsonrpc: '2.0',
        id: 'unknown',
        result: 1,
      } as never);
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('times out webview requests', async () => {
      jest.useFakeTimers();
      const { bus } = setup();
      const pending = bus.sendRequest('webview.slow', undefined, {
        timeoutMs: 100,
      });
      const assertion = expect(pending).rejects.toThrow(
        'Webview request timeout after 100ms: slow',
      );
      jest.advanceTimersByTime(100);
      await assertion;
    });

    it('routes unprefixed requests from the extension to the server first', async () => {
      const { bus, server, webview } = setup();
      bus.registerHandler('local', async () => 'local');
      await expect(bus.sendRequest('local', { x: 1 })).resolves.toBe(
        'server-result',
      );
      expect(server.sendRequest).toHaveBeenCalledWith('local', { x: 1 });
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('routes broadcast.* requests like unprefixed ones', async () => {
      const { bus, server } = setup();
      await bus.sendRequest('broadcast.ping');
      expect(server.sendRequest).toHaveBeenCalledWith('ping', undefined);
    });
  });

  describe('sendNotification', () => {
    it('broadcasts unprefixed notifications to the server and webview', () => {
      const { bus, server, webview } = setup();
      const local = jest.fn();
      bus.onNotification('evt', local);

      bus.sendNotification('evt', { a: 1 });

      expect(server.sendRequest).toHaveBeenCalledWith('evt', { a: 1 });
      expect(webview.postMessage).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        method: 'evt',
        params: { a: 1 },
      });
      expect(local).not.toHaveBeenCalled();
    });

    it('sends server.* only to the server', () => {
      const { bus, server, webview } = setup();
      bus.sendNotification('server.evt', 1);
      expect(server.sendRequest).toHaveBeenCalledWith('evt', 1);
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('sends webview.* only to the webview', () => {
      const { bus, server, webview } = setup();
      bus.sendNotification('webview.evt', 1);
      expect(server.sendRequest).not.toHaveBeenCalled();
      expect(webview.postMessage).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        method: 'evt',
        params: 1,
      });
    });

    it('dispatches extension.* to local handlers only, isolating handler errors', () => {
      const { bus, server, webview } = setup();
      const bad = jest.fn(() => {
        throw new Error('bad');
      });
      const good = jest.fn();
      bus.onNotification('evt', bad);
      bus.onNotification('evt', good);

      bus.sendNotification('extension.evt', { v: 2 });

      expect(bad).toHaveBeenCalledWith({ v: 2 });
      expect(good).toHaveBeenCalledWith({ v: 2 });
      expect(console.error).toHaveBeenCalled();
      expect(server.sendRequest).not.toHaveBeenCalled();
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('extension.* with no local handlers is a no-op', () => {
      const { bus, server, webview } = setup();
      bus.sendNotification('extension.nothing');
      expect(server.sendRequest).not.toHaveBeenCalled();
      expect(webview.postMessage).not.toHaveBeenCalled();
    });

    it('broadcast.* reaches server, webview and local handlers', () => {
      const { bus, server, webview } = setup();
      const local = jest.fn();
      bus.onNotification('evt', local);

      bus.sendNotification('broadcast.evt', 'p');

      expect(server.sendRequest).toHaveBeenCalledWith('evt', 'p');
      expect(webview.postMessage).toHaveBeenCalled();
      expect(local).toHaveBeenCalledWith('p');
    });

    it('swallows server errors (logging them when debug is on)', async () => {
      const { bus, server } = setup({ config: { debug: true } });
      server.sendRequest.mockRejectedValue(new Error('offline'));

      bus.sendNotification('evt');
      bus.sendNotification('server.evt');
      await flush();

      expect(console.log).toHaveBeenCalledWith(
        '[ExtensionMessageBus] Server notification error: offline',
      );
    });
  });

  describe('onNotification', () => {
    it('registers with the server and unsubscribes on dispose of the subscription', () => {
      const { bus, server, serverUnsubs } = setup();
      const h1 = jest.fn();
      const h2 = jest.fn();
      const d1 = bus.onNotification('evt', h1);
      const d2 = bus.onNotification('evt', h2);

      expect(server.onNotification).toHaveBeenCalledWith('evt', h1);

      d1();
      expect(serverUnsubs[0]).toHaveBeenCalled();
      bus.sendNotification('extension.evt', 1);
      expect(h1).not.toHaveBeenCalled();
      expect(h2).toHaveBeenCalledWith(1);

      d2();
      bus.sendNotification('extension.evt', 2);
      expect(h2).toHaveBeenCalledTimes(1);
    });
  });

  describe('registerHandler / introspection', () => {
    it('rejects duplicates unless overwrite is set', () => {
      const { bus } = setup();
      bus.registerHandler('m', async () => 1);
      expect(() => bus.registerHandler('m', async () => 2)).toThrow(
        'Handler already registered for method: m',
      );
      bus.registerHandler('m', async () => 3, { overwrite: true });
      expect(bus.getRegisteredHandlers()).toEqual([
        { method: 'm', canBeOverwritten: true },
      ]);
    });

    it('unregisters via the returned disposable', () => {
      const { bus } = setup();
      const dispose = bus.registerHandler('m', async () => 1);
      expect(bus.hasHandler('m')).toBe(true);
      dispose();
      expect(bus.hasHandler('m')).toBe(false);
      expect(bus.getRegisteredHandlers()).toEqual([]);
    });

    it('merges registry handlers without duplicating manual ones', () => {
      const { bus } = setup({ registry: { a: () => 1, b: () => 2 } });
      bus.registerHandler('a', async () => 0);
      expect(bus.getRegisteredHandlers()).toEqual([
        { method: 'a', canBeOverwritten: false },
        { method: 'b', canBeOverwritten: false },
      ]);
      expect(bus.hasHandler('b')).toBe(true);
      expect(bus.hasHandler('c')).toBe(false);
    });

    it('prefers manual handlers over registry handlers', async () => {
      const { bus } = setup({ registry: { a: () => 'registry' } });
      bus.registerHandler('a', async () => 'manual');
      await expect(bus.sendRequest('extension.a')).resolves.toBe('manual');
    });
  });

  describe('webview messages', () => {
    it('answers webview requests using extension handlers first', async () => {
      const { bus, server, receive, lastPosted } = setup();
      bus.registerHandler('local', async (p: { n: number }) => p.n + 1);

      receive({ jsonrpc: '2.0', id: 9, method: 'local', params: { n: 1 } });
      await flush();

      expect(server.sendRequest).not.toHaveBeenCalled();
      expect(lastPosted()).toEqual({ jsonrpc: '2.0', id: 9, result: 2 });
    });

    it('forwards unhandled webview requests to the server', async () => {
      const { server, receive, lastPosted } = setup({ registry: {} });

      receive({ jsonrpc: '2.0', id: 10, method: 'remote', params: 'p' });
      await flush();

      expect(server.sendRequest).toHaveBeenCalledWith('remote', 'p');
      expect(lastPosted()).toEqual({
        jsonrpc: '2.0',
        id: 10,
        result: 'server-result',
      });
    });

    it('responds with a JSON-RPC internal error when routing fails', async () => {
      const { bus, server, lastPosted } = setup({ config: { debug: true } });
      server.sendRequest.mockRejectedValue(new Error('server down'));

      await bus.handleWebviewMessage({ jsonrpc: '2.0', id: 11, method: 'x' });

      expect(lastPosted()).toEqual({
        jsonrpc: '2.0',
        id: 11,
        error: { code: -32603, message: 'server down' },
      });
    });

    it('stringifies non-Error failures', async () => {
      const { bus, server, lastPosted } = setup({ config: { debug: true } });
      server.sendRequest.mockRejectedValue('plain');

      await bus.handleWebviewMessage({ jsonrpc: '2.0', id: 12, method: 'x' });

      expect(lastPosted()).toEqual({
        jsonrpc: '2.0',
        id: 12,
        error: { code: -32603, message: 'plain' },
      });
    });

    it('ignores messages that are not JSON-RPC requests', async () => {
      const { receive, webview, server } = setup({ config: { debug: true } });
      receive({ hello: 'world' });
      receive(null);
      receive('text');
      await flush();
      expect(server.sendRequest).not.toHaveBeenCalled();
      expect(webview.postMessage).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        '[ExtensionMessageBus] Message is not a valid JSON-RPC request',
      );
    });
  });

  describe('debug logging', () => {
    it('is silent by default', async () => {
      const { bus } = setup();
      await bus.sendRequest('server.x');
      expect(console.log).not.toHaveBeenCalled();
    });

    it('logs when debug is enabled', async () => {
      const { bus } = setup({ config: { debug: true } });
      await bus.sendRequest('server.x');
      expect(console.log).toHaveBeenCalledWith(
        expect.stringContaining('[ExtensionMessageBus] sendRequest: server.x'),
      );
    });
  });

  describe('dispose', () => {
    it('rejects pending webview requests, unsubscribes and blocks further use', async () => {
      const { bus, serverUnsubs } = setup();
      bus.onNotification('evt', jest.fn());
      bus.registerHandler('m', async () => 1);
      const pending = bus.sendRequest('webview.slow');

      bus.onModuleDestroy();
      bus.dispose();

      await expect(pending).rejects.toThrow('MessageBus disposed');
      expect(serverUnsubs[0]).toHaveBeenCalledTimes(1);
      expect(bus.getRegisteredHandlers()).toEqual([]);
      await expect(bus.sendRequest('x')).rejects.toThrow(
        'MessageBus has been disposed',
      );
      expect(() => bus.sendNotification('x')).toThrow(
        'MessageBus has been disposed',
      );
      expect(() => bus.onNotification('x', jest.fn())).toThrow(
        'MessageBus has been disposed',
      );
      expect(() => bus.registerHandler('x', jest.fn())).toThrow(
        'MessageBus has been disposed',
      );
    });
  });
});
