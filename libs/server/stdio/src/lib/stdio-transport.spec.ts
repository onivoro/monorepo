import { EventEmitter } from 'events';
import * as readline from 'readline';
import { StdioTransport } from './stdio-transport';

jest.mock('readline', () => ({ createInterface: jest.fn() }));

type FakeInterface = EventEmitter & { close: jest.Mock };

describe('StdioTransport', () => {
  let rl: FakeInterface;
  let write: jest.SpyInstance;
  let transport: StdioTransport;

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  const send = async (line: string) => {
    rl.emit('line', line);
    await flush();
  };

  const responses = () =>
    write.mock.calls.map(([chunk]) => {
      expect(chunk).toMatch(/\n$/);
      return JSON.parse(chunk as string);
    });

  beforeEach(() => {
    rl = Object.assign(new EventEmitter(), { close: jest.fn() });
    (readline.createInterface as jest.Mock).mockReturnValue(rl);
    write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    transport = new StdioTransport();
  });

  afterEach(() => {
    write.mockRestore();
  });

  it('reads lines from stdin', () => {
    expect(readline.createInterface).toHaveBeenCalledWith({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
  });

  describe('handler registry', () => {
    it('registers, lists and removes handlers', () => {
      transport.on('a', async () => 1);
      transport.on('b', async () => 2);

      expect(transport.hasHandler('a')).toBe(true);
      expect(transport.getRegisteredMethods()).toEqual(['a', 'b']);

      transport.removeHandler('a');
      expect(transport.hasHandler('a')).toBe(false);
      expect(transport.getRegisteredMethods()).toEqual(['b']);
    });

    it('refuses to register a method twice', () => {
      transport.on('a', async () => 1);

      expect(() => transport.on('a', async () => 2)).toThrow(
        'Handler already registered for method: a',
      );
    });

    it('allows re-registering after removal', () => {
      transport.on('a', async () => 1);
      transport.removeHandler('a');

      expect(() => transport.on('a', async () => 2)).not.toThrow();
    });
  });

  describe('request handling', () => {
    it('calls the handler with params and writes the result', async () => {
      const handler = jest.fn(async (params: { id: string }) => ({
        user: params.id,
      }));
      transport.on('user.get', handler);

      await send(
        JSON.stringify({
          jsonrpc: '2.0',
          id: 7,
          method: 'user.get',
          params: { id: 'u1' },
        }),
      );

      expect(handler).toHaveBeenCalledWith({ id: 'u1' });
      expect(responses()).toEqual([
        { jsonrpc: '2.0', id: 7, result: { user: 'u1' } },
      ]);
    });

    it('keeps string ids', async () => {
      transport.on('ping', async () => 'pong');

      await send(JSON.stringify({ jsonrpc: '2.0', id: 'abc', method: 'ping' }));

      expect(responses()).toEqual([
        { jsonrpc: '2.0', id: 'abc', result: 'pong' },
      ]);
    });

    it('answers METHOD_NOT_FOUND for unknown methods', async () => {
      await send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'missing' }));

      expect(responses()).toEqual([
        {
          jsonrpc: '2.0',
          id: 1,
          error: { code: -32601, message: 'Method not found: missing' },
        },
      ]);
    });

    it('answers INTERNAL_ERROR with message and stack when a handler throws', async () => {
      const error = new Error('kaboom');
      transport.on('fail', async () => {
        throw error;
      });

      await send(JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'fail' }));

      expect(responses()).toEqual([
        {
          jsonrpc: '2.0',
          id: 2,
          error: { code: -32603, message: 'kaboom', data: error.stack },
        },
      ]);
    });

    it('answers a generic INTERNAL_ERROR when a handler throws a non-Error', async () => {
      transport.on('fail', async () => {
        throw 'nope';
      });

      await send(JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'fail' }));

      expect(responses()).toEqual([
        {
          jsonrpc: '2.0',
          id: 3,
          error: { code: -32603, message: 'Internal error' },
        },
      ]);
    });

    it('ignores notifications (no id)', async () => {
      const handler = jest.fn(async () => 1);
      transport.on('evt', handler);

      await send(JSON.stringify({ jsonrpc: '2.0', method: 'evt' }));

      expect(handler).not.toHaveBeenCalled();
      expect(write).not.toHaveBeenCalled();
    });

    it('answers INVALID_REQUEST with the request id when method is missing', async () => {
      await send(JSON.stringify({ jsonrpc: '2.0', id: 4 }));
      expect(responses()).toEqual([
        {
          jsonrpc: '2.0',
          id: 4,
          error: { code: -32600, message: 'Method not specified' },
        },
      ]);
    });

    it.each([
      ['an invalid id', { jsonrpc: '2.0', id: { nested: true } }],
      ['no id', { jsonrpc: '2.0' }],
      ['a non-object message', 5],
    ])(
      'answers INVALID_REQUEST with a null id for %s',
      async (_label, message) => {
        await send(JSON.stringify(message));
        expect(responses()).toEqual([
          {
            jsonrpc: '2.0',
            id: null,
            error: { code: -32600, message: 'Method not specified' },
          },
        ]);
      },
    );

    it('answers PARSE_ERROR with a null id for invalid JSON', async () => {
      await send('{not json');
      expect(responses()).toEqual([
        {
          jsonrpc: '2.0',
          id: null,
          error: { code: -32700, message: 'Parse error' },
        },
      ]);
    });

    it('ignores blank lines', async () => {
      await send('');
      await send('   ');
      expect(write).not.toHaveBeenCalled();
    });
  });

  describe('notifications', () => {
    it('passes notifications to listeners without responding', async () => {
      const listener = jest.fn();
      transport.onNotification(listener);

      await send(
        JSON.stringify({ jsonrpc: '2.0', method: 'evt', params: { a: 1 } }),
      );

      expect(listener).toHaveBeenCalledWith('evt', { a: 1 });
      expect(write).not.toHaveBeenCalled();
    });

    it('does not pass requests to listeners', async () => {
      const listener = jest.fn();
      transport.onNotification(listener);

      await send(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'evt' }));

      expect(listener).not.toHaveBeenCalled();
    });

    it('returns a function that removes the listener', async () => {
      const listener = jest.fn();
      const remove = transport.onNotification(listener);

      remove();
      await send(JSON.stringify({ jsonrpc: '2.0', method: 'evt' }));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  it('close() closes the readline interface', () => {
    transport.close();
    expect(rl.close).toHaveBeenCalledTimes(1);
  });
});
