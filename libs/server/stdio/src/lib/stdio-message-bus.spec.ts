import { EventEmitter } from 'events';
import * as readline from 'readline';
import { StdioMessageBus, createStdioMessageBus } from './stdio-message-bus';
import { StdioTransport } from './stdio-transport';
import { StdioTransportService } from './stdio-transport-service';

jest.mock('readline', () => ({ createInterface: jest.fn() }));

describe('StdioMessageBus', () => {
  let transport: StdioTransport;
  let transportService: jest.Mocked<
    Pick<StdioTransportService, 'getTransport' | 'sendNotification'>
  >;
  let bus: StdioMessageBus;
  let log: jest.SpyInstance;
  let rl: EventEmitter;

  const notify = (method: string, params: unknown) =>
    rl.emit('line', JSON.stringify({ jsonrpc: '2.0', method, params }));

  beforeEach(() => {
    rl = Object.assign(new EventEmitter(), { close: jest.fn() });
    (readline.createInterface as jest.Mock).mockReturnValue(rl);
    transport = new StdioTransport();
    transportService = {
      getTransport: jest.fn(() => transport),
      sendNotification: jest.fn(),
    };
    bus = new StdioMessageBus(transportService as never);
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    log.mockRestore();
  });

  it('refuses to send requests', () => {
    expect(() => bus.sendRequest('server.health')).toThrow(
      /sendRequest\(\) is not supported in stdio server environment.*Method: server\.health/,
    );
  });

  it('forwards notifications to the transport service', () => {
    bus.sendNotification('extension.ready', { version: '1.0' });

    expect(transportService.sendNotification).toHaveBeenCalledWith(
      'extension.ready',
      { version: '1.0' },
    );
  });

  describe('registerHandler', () => {
    it('registers the handler on the transport', () => {
      const handler = async () => 1;
      bus.registerHandler('a', handler);

      expect(transport.hasHandler('a')).toBe(true);
      expect(bus.hasHandler('a')).toBe(true);
      expect(log).toHaveBeenCalledWith(
        '[StdioMessageBus] Registered handler: a',
      );
    });

    it('throws when the method already has a handler', () => {
      bus.registerHandler('a', async () => 1);

      expect(() => bus.registerHandler('a', async () => 2)).toThrow(
        'Handler already registered for method: a',
      );
    });

    it('also refuses methods registered directly on the transport', () => {
      transport.on('direct', async () => 1);

      expect(() => bus.registerHandler('direct', async () => 2)).toThrow(
        'Handler already registered for method: direct',
      );
    });

    it('replaces the handler when overwrite is set', () => {
      const first = async () => 1;
      const second = async () => 2;
      bus.registerHandler('a', first);
      const removeSpy = jest.spyOn(transport, 'removeHandler');

      bus.registerHandler('a', second, { overwrite: true });

      expect(removeSpy).toHaveBeenCalledWith('a');
      expect(bus.getRegisteredHandlers()).toEqual([
        { method: 'a', canBeOverwritten: true },
      ]);
    });

    it('registers a new method with overwrite without removing anything', () => {
      const removeSpy = jest.spyOn(transport, 'removeHandler');

      bus.registerHandler('fresh', async () => 1, { overwrite: true });

      expect(removeSpy).not.toHaveBeenCalled();
      expect(bus.hasHandler('fresh')).toBe(true);
    });

    it('returns a disposable that unregisters the handler', () => {
      const dispose = bus.registerHandler('a', async () => 1);

      dispose();

      expect(bus.hasHandler('a')).toBe(false);
      expect(bus.getRegisteredHandlers()).toEqual([]);
      expect(log).toHaveBeenCalledWith(
        '[StdioMessageBus] Unregistered handler: a',
      );
    });
  });

  describe('getRegisteredHandlers', () => {
    it('lists every transport method with its overwrite flag', () => {
      transport.on('direct', async () => 0);
      bus.registerHandler('a', async () => 1);
      bus.registerHandler('b', async () => 2, { overwrite: true });

      expect(bus.getRegisteredHandlers()).toEqual([
        { method: 'direct', canBeOverwritten: false },
        { method: 'a', canBeOverwritten: false },
        { method: 'b', canBeOverwritten: true },
      ]);
    });
  });

  describe('onNotification', () => {
    it('dispatches incoming notifications to handlers for that method', () => {
      const a = jest.fn();
      const b = jest.fn();
      const other = jest.fn();
      bus.onNotification('evt', a);
      bus.onNotification('evt', b);
      bus.onNotification('other', other);

      notify('evt', { x: 1 });

      expect(a).toHaveBeenCalledWith({ x: 1 });
      expect(b).toHaveBeenCalledWith({ x: 1 });
      expect(other).not.toHaveBeenCalled();
    });

    it('stops dispatching to a handler once disposed', () => {
      const handler = jest.fn();
      const dispose = bus.onNotification('evt', handler);

      dispose();
      notify('evt', 1);

      expect(handler).not.toHaveBeenCalled();
    });

    it('keeps dispatching when a handler throws', () => {
      const error = jest
        .spyOn(console, 'error')
        .mockImplementation(() => undefined);
      const after = jest.fn();
      bus.onNotification('evt', () => {
        throw new Error('bad');
      });
      bus.onNotification('evt', after);

      notify('evt', 1);

      expect(after).toHaveBeenCalledWith(1);
      expect(error).toHaveBeenCalled();
      error.mockRestore();
    });

    it('returns a disposable that can be called repeatedly', () => {
      const a = bus.onNotification('evt', jest.fn());
      const b = bus.onNotification('evt', jest.fn());

      expect(() => {
        a();
        b();
        a();
      }).not.toThrow();
    });
  });

  describe('dispose', () => {
    it('makes subsequent calls throw', () => {
      bus.dispose();

      expect(() => bus.sendNotification('a')).toThrow(
        'MessageBus has been disposed',
      );
      expect(() => bus.onNotification('a', jest.fn())).toThrow(
        'MessageBus has been disposed',
      );
      expect(() => bus.registerHandler('a', async () => 1)).toThrow(
        'MessageBus has been disposed',
      );
      expect(transportService.sendNotification).not.toHaveBeenCalled();
    });

    it('is idempotent and runs on module destroy', () => {
      bus.onModuleDestroy();
      expect(() => bus.dispose()).not.toThrow();
      expect(() => bus.sendNotification('a')).toThrow(
        'MessageBus has been disposed',
      );
    });

    it('unregisters its handlers from the transport', () => {
      transport.on('direct', async () => 0);
      bus.registerHandler('a', async () => 1);
      bus.dispose();
      expect(transport.hasHandler('a')).toBe(false);
      expect(transport.hasHandler('direct')).toBe(true);
    });

    it('stops dispatching notifications', () => {
      const handler = jest.fn();
      bus.onNotification('evt', handler);
      bus.dispose();

      notify('evt', 1);

      expect(handler).not.toHaveBeenCalled();
    });
  });
});

describe('createStdioMessageBus', () => {
  it('builds a bus around the given transport service', () => {
    const service = { sendNotification: jest.fn() };
    const bus = createStdioMessageBus(service as never, {
      requestTimeoutMs: 5,
    });

    expect(bus).toBeInstanceOf(StdioMessageBus);
    bus.sendNotification('x', 1);
    expect(service.sendNotification).toHaveBeenCalledWith('x', 1);
  });
});
