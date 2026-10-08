import { JsonRpcResponseError } from '../errors/jsonrpc-response-error';
import {
  createWebviewMessageBus,
  createWebviewMessageBusWithApi,
  VscodeApiBridge,
  WebviewMessageBus,
} from './webview-message-bus';

const makeApi = (): jest.Mocked<VscodeApiBridge> => ({
  postMessage: jest.fn(),
  getState: jest.fn(),
  setState: jest.fn(),
});

const deliver = (detail: unknown, eventName = 'vscode-message') =>
  window.dispatchEvent(new CustomEvent(eventName, { detail }));

const lastPosted = (api: jest.Mocked<VscodeApiBridge>) =>
  api.postMessage.mock.calls[api.postMessage.mock.calls.length - 1][0] as {
    id: string;
    [key: string]: unknown;
  };

describe('WebviewMessageBus', () => {
  let api: jest.Mocked<VscodeApiBridge>;
  let bus: WebviewMessageBus;

  beforeEach(() => {
    jest.useFakeTimers();
    api = makeApi();
    bus = new WebviewMessageBus(api);
  });

  afterEach(() => {
    bus.dispose();
    jest.useRealTimers();
  });

  describe('sendRequest', () => {
    it('posts a JSON-RPC request with a unique id', () => {
      bus.sendRequest('server.health', { a: 1 }).catch(() => undefined);
      bus.sendRequest('server.health').catch(() => undefined);

      expect(api.postMessage).toHaveBeenCalledTimes(2);
      const [first, second] = api.postMessage.mock.calls.map(
        ([m]) => m as { id: string },
      );
      expect(first).toEqual({
        jsonrpc: '2.0',
        id: expect.stringMatching(/^webview-1-\d+$/),
        method: 'server.health',
        params: { a: 1 },
      });
      expect(second.id).toMatch(/^webview-2-\d+$/);
      expect(second.id).not.toBe(first.id);
    });

    it('resolves with the result of the matching response', async () => {
      const promise = bus.sendRequest('foo');
      const { id } = lastPosted(api);

      deliver({ jsonrpc: '2.0', id, result: { ok: true } });

      await expect(promise).resolves.toEqual({ ok: true });
    });

    it('rejects with the error message of an error response', async () => {
      const promise = bus.sendRequest('foo');
      const { id } = lastPosted(api);

      deliver({ jsonrpc: '2.0', id, error: { code: -32601, message: 'nope' } });

      await expect(promise).rejects.toThrow('nope');
    });

    it('keeps the error code and data on the rejection', async () => {
      const promise = bus.sendRequest('foo');
      const { id } = lastPosted(api);

      deliver({
        jsonrpc: '2.0',
        id,
        error: { code: -32001, message: 'denied', data: { reason: 'x' } },
      });

      const error = await promise.catch((e: unknown) => e);
      expect(error).toBeInstanceOf(JsonRpcResponseError);
      expect(error).toBeInstanceOf(Error);
      expect(error).toMatchObject({
        name: 'JsonRpcResponseError',
        message: 'denied',
        code: -32001,
        data: { reason: 'x' },
      });
    });

    it('resolves with undefined when the response has neither result nor error', async () => {
      const promise = bus.sendRequest('foo');
      const { id } = lastPosted(api);

      deliver({ jsonrpc: '2.0', id });

      await expect(promise).resolves.toBeUndefined();
    });

    it('falls back to "Unknown error" when the error has no message', async () => {
      const promise = bus.sendRequest('foo');
      const { id } = lastPosted(api);

      deliver({ jsonrpc: '2.0', id, error: { code: -1, message: '' } });

      await expect(promise).rejects.toThrow('Unknown error');
    });

    it('ignores responses for unknown ids and a second response for the same id', async () => {
      const promise = bus.sendRequest('foo');
      const { id } = lastPosted(api);

      deliver({ jsonrpc: '2.0', id: 'other', result: 'wrong' });
      deliver({ jsonrpc: '2.0', id, result: 'right' });
      deliver({ jsonrpc: '2.0', id, result: 'late' });

      await expect(promise).resolves.toBe('right');
    });

    it('rejects after the default timeout', async () => {
      const promise = bus.sendRequest('slow');

      jest.advanceTimersByTime(29999);
      const settled = jest.fn();
      promise.then(settled, settled);
      await Promise.resolve();
      expect(settled).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1);
      await expect(promise).rejects.toThrow(
        'Request timeout after 30000ms: slow',
      );
    });

    it('honours a per-request timeout over the configured one', async () => {
      const custom = new WebviewMessageBus(api, { requestTimeoutMs: 1000 });
      const a = custom.sendRequest('a');
      const b = custom.sendRequest('b', undefined, { timeoutMs: 50 });

      jest.advanceTimersByTime(50);
      await expect(b).rejects.toThrow('Request timeout after 50ms: b');

      jest.advanceTimersByTime(950);
      await expect(a).rejects.toThrow('Request timeout after 1000ms: a');
      custom.dispose();
    });

    it('does not resolve a request after it timed out', async () => {
      const promise = bus.sendRequest('slow', undefined, { timeoutMs: 10 });
      const { id } = lastPosted(api);

      jest.advanceTimersByTime(10);
      deliver({ jsonrpc: '2.0', id, result: 'too late' });

      await expect(promise).rejects.toThrow('Request timeout');
    });
  });

  describe('sendNotification', () => {
    it('posts a notification without an id', () => {
      bus.sendNotification('broadcast.ping', { n: 1 });

      expect(api.postMessage).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        method: 'broadcast.ping',
        params: { n: 1 },
      });
      expect(lastPosted(api)).not.toHaveProperty('id');
    });
  });

  describe('onNotification', () => {
    it('calls every handler for the method with the params', () => {
      const a = jest.fn();
      const b = jest.fn();
      const other = jest.fn();
      bus.onNotification('evt', a);
      bus.onNotification('evt', b);
      bus.onNotification('other', other);

      deliver({ jsonrpc: '2.0', method: 'evt', params: { x: 1 } });

      expect(a).toHaveBeenCalledWith({ x: 1 });
      expect(b).toHaveBeenCalledWith({ x: 1 });
      expect(other).not.toHaveBeenCalled();
    });

    it('stops calling a handler once it is disposed', () => {
      const a = jest.fn();
      const b = jest.fn();
      const disposeA = bus.onNotification('evt', a);
      const disposeB = bus.onNotification('evt', b);

      disposeA();
      deliver({ jsonrpc: '2.0', method: 'evt' });
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);

      disposeB();
      deliver({ jsonrpc: '2.0', method: 'evt' });
      expect(b).toHaveBeenCalledTimes(1);
    });

    it('keeps calling other handlers when one throws', () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const boom = new Error('boom');
      const good = jest.fn();
      bus.onNotification('evt', () => {
        throw boom;
      });
      bus.onNotification('evt', good);

      deliver({ jsonrpc: '2.0', method: 'evt', params: 1 });

      expect(good).toHaveBeenCalledWith(1);
      expect(error).toHaveBeenCalledWith(
        'Error in notification handler for "evt":',
        boom,
      );
      error.mockRestore();
    });

    it('ignores notifications nobody listens to', () => {
      expect(() =>
        deliver({ jsonrpc: '2.0', method: 'unheard' }),
      ).not.toThrow();
    });
  });

  describe('incoming message filtering', () => {
    it.each([
      ['undefined', undefined],
      ['null', null],
      ['a string', 'hello'],
      ['a number', 3],
      ['an object with neither id nor method', { jsonrpc: '2.0' }],
      ['a non-string method', { jsonrpc: '2.0', method: 5 }],
    ])('ignores %s', (_label, detail) => {
      const handler = jest.fn();
      bus.onNotification('5', handler);

      expect(() => deliver(detail)).not.toThrow();
      expect(handler).not.toHaveBeenCalled();
      expect(api.postMessage).not.toHaveBeenCalled();
    });

    it('listens on a custom event name when configured', async () => {
      const custom = new WebviewMessageBus(api, {
        responseEventName: 'custom-event',
      });
      const promise = custom.sendRequest('foo');
      const { id } = lastPosted(api);

      deliver({ jsonrpc: '2.0', id, result: 'default' }, 'vscode-message');
      deliver({ jsonrpc: '2.0', id, result: 'custom' }, 'custom-event');

      await expect(promise).resolves.toBe('custom');
      custom.dispose();
    });
  });

  describe('registerHandler', () => {
    it('registers, reports and unregisters a handler', () => {
      const dispose = bus.registerHandler('a', async () => 1);
      bus.registerHandler('b', async () => 2, { overwrite: true });

      expect(bus.hasHandler('a')).toBe(true);
      expect(bus.getRegisteredHandlers()).toEqual([
        { method: 'a', canBeOverwritten: false },
        { method: 'b', canBeOverwritten: true },
      ]);

      dispose();
      expect(bus.hasHandler('a')).toBe(false);
      expect(bus.getRegisteredHandlers()).toEqual([
        { method: 'b', canBeOverwritten: true },
      ]);
    });

    it('throws when the method already has a handler', () => {
      bus.registerHandler('a', async () => 1);

      expect(() => bus.registerHandler('a', async () => 2)).toThrow(
        'Handler already registered for method: a',
      );
    });

    it('replaces an existing handler when overwrite is set', () => {
      bus.registerHandler('a', async () => 1);

      expect(() =>
        bus.registerHandler('a', async () => 2, { overwrite: true }),
      ).not.toThrow();
      expect(bus.getRegisteredHandlers()).toEqual([
        { method: 'a', canBeOverwritten: true },
      ]);
    });

    it('answers an incoming request with the handler result', async () => {
      const handler = jest.fn(async (p: { n: number }) => p.n + 1);
      bus.registerHandler('a', handler);

      deliver({ jsonrpc: '2.0', id: 'ext-1', method: 'a', params: { n: 1 } });
      await Promise.resolve();

      expect(handler).toHaveBeenCalledWith({ n: 1 });
      expect(api.postMessage).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 'ext-1',
        result: 2,
      });
    });

    it('does not treat an incoming request as a response to a pending request', async () => {
      const promise = bus.sendRequest('foo');
      const { id } = lastPosted(api);
      bus.registerHandler('a', async () => 'handled');

      deliver({ jsonrpc: '2.0', id, method: 'a' });
      await Promise.resolve();

      expect(lastPosted(api)).toEqual({
        jsonrpc: '2.0',
        id,
        result: 'handled',
      });
      deliver({ jsonrpc: '2.0', id, result: 'response' });
      await expect(promise).resolves.toBe('response');
    });

    it('answers a request for an unknown method with -32601', () => {
      deliver({ jsonrpc: '2.0', id: 7, method: 'missing' });

      expect(api.postMessage).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 7,
        error: { code: -32601, message: 'Method not found: missing' },
      });
    });

    it('answers with -32603 when the handler throws', async () => {
      bus.registerHandler('a', async () => {
        throw new Error('broken');
      });

      deliver({ jsonrpc: '2.0', id: 8, method: 'a' });
      await Promise.resolve();
      await Promise.resolve();

      expect(api.postMessage).toHaveBeenCalledWith({
        jsonrpc: '2.0',
        id: 8,
        error: { code: -32603, message: 'broken' },
      });
    });
  });

  describe('dispose', () => {
    it('rejects pending requests and stops listening', async () => {
      const promise = bus.sendRequest('foo');
      const { id } = lastPosted(api);
      const handler = jest.fn();
      bus.onNotification('evt', handler);
      bus.registerHandler('a', async () => 1);

      bus.dispose();

      await expect(promise).rejects.toThrow('MessageBus disposed');
      deliver({ jsonrpc: '2.0', id, result: 'x' });
      deliver({ jsonrpc: '2.0', method: 'evt' });
      expect(handler).not.toHaveBeenCalled();
      expect(bus.getRegisteredHandlers()).toEqual([]);
      expect(jest.getTimerCount()).toBe(0);
    });

    it('is idempotent', () => {
      const remove = jest.spyOn(window, 'removeEventListener');
      bus.dispose();
      bus.dispose();
      expect(remove).toHaveBeenCalledTimes(1);
      remove.mockRestore();
    });

    it('makes every mutating call throw', () => {
      bus.dispose();

      expect(() => bus.sendRequest('a')).toThrow(
        'MessageBus has been disposed',
      );
      expect(() => bus.sendNotification('a')).toThrow(
        'MessageBus has been disposed',
      );
      expect(() => bus.onNotification('a', jest.fn())).toThrow(
        'MessageBus has been disposed',
      );
      expect(() => bus.registerHandler('a', async () => 1)).toThrow(
        'MessageBus has been disposed',
      );
    });
  });
});

describe('createWebviewMessageBus', () => {
  const win = window as unknown as { vscodeApi?: VscodeApiBridge };

  afterEach(() => {
    delete win.vscodeApi;
  });

  it('throws outside a VSCode webview', () => {
    expect(() => createWebviewMessageBus()).toThrow('VSCode API not available');
  });

  it('uses window.vscodeApi and the given config', async () => {
    jest.useFakeTimers();
    const api = makeApi();
    win.vscodeApi = api;

    const bus = createWebviewMessageBus({ requestTimeoutMs: 5 });
    expect(bus).toBeInstanceOf(WebviewMessageBus);

    const promise = bus.sendRequest('x');
    expect(api.postMessage).toHaveBeenCalled();
    jest.advanceTimersByTime(5);
    await expect(promise).rejects.toThrow('Request timeout after 5ms: x');

    bus.dispose();
    jest.useRealTimers();
  });
});

describe('createWebviewMessageBusWithApi', () => {
  it('builds a bus around the given bridge', () => {
    const api = makeApi();
    const bus = createWebviewMessageBusWithApi(api);

    expect(bus).toBeInstanceOf(WebviewMessageBus);
    bus.sendNotification('n');
    expect(api.postMessage).toHaveBeenCalledWith({
      jsonrpc: '2.0',
      method: 'n',
      params: undefined,
    });
    bus.dispose();
  });
});
