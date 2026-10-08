import { EventEmitter } from 'events';
import * as path from 'path';
import { spawn } from 'child_process';
import { StdioServerProcess } from './stdio-server-process';

jest.mock('child_process', () => ({ spawn: jest.fn() }));

type FakeChild = EventEmitter & {
  stdin: { write: jest.Mock } | null;
  stdout: EventEmitter | null;
  stderr: EventEmitter | null;
  kill: jest.Mock;
};

const makeChild = (): FakeChild =>
  Object.assign(new EventEmitter(), {
    stdin: { write: jest.fn() },
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    kill: jest.fn(),
  });

describe('StdioServerProcess', () => {
  let child: FakeChild;

  const stdout = (text: string) =>
    child.stdout!.emit('data', Buffer.from(text));

  const lastRequest = () => {
    const calls = child.stdin!.write.mock.calls;
    return JSON.parse(calls[calls.length - 1][0]);
  };

  const flush = () => new Promise((resolve) => setImmediate(resolve));

  beforeEach(() => {
    child = makeChild();
    (spawn as jest.Mock).mockReset().mockReturnValue(child);
  });

  describe('lifecycle', () => {
    it('spawns node with the resolved script and extra node args', () => {
      const server = new StdioServerProcess();

      server.start('/ext', 'dist/main.js', ['--inspect']);

      expect(spawn).toHaveBeenCalledWith(
        'node',
        ['--inspect', path.resolve('/ext', 'dist/main.js')],
        { stdio: ['pipe', 'pipe', 'pipe'] },
      );
      expect(server.isRunning).toBe(true);
    });

    it('uses an absolute script path as-is', () => {
      new StdioServerProcess().start('/ext', '/abs/server.js');

      expect(spawn).toHaveBeenCalledWith('node', ['/abs/server.js'], {
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    });

    it('refuses to start twice', () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');

      expect(() => server.start('/ext', 'a.js')).toThrow(
        'Server process is already running',
      );
    });

    it('stop() kills the process and rejects pending requests', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const pending = server.sendRequest('slow');

      server.stop();

      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(server.isRunning).toBe(false);
      await expect(pending).rejects.toThrow('Server process stopped');
    });

    it('stop() is a no-op when not running', () => {
      const server = new StdioServerProcess();
      expect(() => server.stop()).not.toThrow();
      expect(server.isRunning).toBe(false);
    });

    it('can be restarted after stop()', () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      server.stop();

      expect(() => server.start('/ext', 'a.js')).not.toThrow();
      expect(spawn).toHaveBeenCalledTimes(2);
    });

    it('reports exit, rejects pending requests and marks itself stopped', async () => {
      const onExit = jest.fn();
      const server = new StdioServerProcess({ onExit });
      server.start('/ext', 'a.js');
      const pending = server.sendRequest('x');

      child.emit('exit', 3);

      await expect(pending).rejects.toThrow(
        'Server process exited with code 3',
      );
      expect(onExit).toHaveBeenCalledWith(3);
      expect(server.isRunning).toBe(false);
    });

    it('reports process errors', () => {
      const onError = jest.fn();
      const server = new StdioServerProcess({ onError });
      server.start('/ext', 'a.js');
      const error = new Error('spawn ENOENT');

      child.emit('error', error);

      expect(onError).toHaveBeenCalledWith(error);
    });

    it('forwards stderr output', () => {
      const onStderr = jest.fn();
      const server = new StdioServerProcess({ onStderr });
      server.start('/ext', 'a.js');

      child.stderr!.emit('data', Buffer.from('warning!'));

      expect(onStderr).toHaveBeenCalledWith('warning!');
    });

    it('tolerates default callbacks and missing stdio streams', () => {
      child.stdout = null;
      child.stderr = null;
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');

      expect(() => {
        child.emit('error', new Error('x'));
        child.emit('exit', 0);
      }).not.toThrow();
    });
  });

  describe('sendRequest', () => {
    it('rejects when the process is not running', async () => {
      await expect(new StdioServerProcess().sendRequest('x')).rejects.toThrow(
        'Server process not running',
      );
    });

    it('rejects when the process has no stdin', async () => {
      child.stdin = null;
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');

      await expect(server.sendRequest('x')).rejects.toThrow(
        'Server process not running',
      );
    });

    it('writes a line-delimited JSON-RPC request', () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');

      server.sendRequest('health', { verbose: true }).catch(() => undefined);

      expect(child.stdin!.write.mock.calls[0][0]).toMatch(/\n$/);
      expect(lastRequest()).toEqual({
        jsonrpc: '2.0',
        id: '1',
        method: 'health',
        params: { verbose: true },
      });
      server.stop();
    });

    it('resolves with the result of the matching response', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const promise = server.sendRequest('health');

      stdout(
        JSON.stringify({
          jsonrpc: '2.0',
          id: lastRequest().id,
          result: { status: 'ok' },
        }) + '\n',
      );

      await expect(promise).resolves.toEqual({ status: 'ok' });
    });

    it('matches numeric response ids to string request ids', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const promise = server.sendRequest('x');

      stdout(JSON.stringify({ jsonrpc: '2.0', id: 1, result: 'num' }) + '\n');

      await expect(promise).resolves.toBe('num');
    });

    it('rejects with the error message of an error response', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const promise = server.sendRequest('x');

      stdout(
        JSON.stringify({
          jsonrpc: '2.0',
          id: '1',
          error: { code: -32601, message: 'Method not found: x' },
        }) + '\n',
      );

      await expect(promise).rejects.toThrow('Method not found: x');
    });

    it('falls back to "Unknown error" for an error without a message', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const promise = server.sendRequest('x');

      stdout(
        JSON.stringify({ jsonrpc: '2.0', id: '1', error: { code: 1 } }) + '\n',
      );

      await expect(promise).rejects.toThrow('Unknown error');
    });

    it('times out using the configured timeout or a per-request one', async () => {
      jest.useFakeTimers();
      try {
        const server = new StdioServerProcess({ requestTimeoutMs: 100 });
        server.start('/ext', 'a.js');
        const a = server.sendRequest('a');
        const b = server.sendRequest('b', undefined, 10);

        jest.advanceTimersByTime(10);
        await expect(b).rejects.toThrow('timed out after 10ms');

        jest.advanceTimersByTime(90);
        await expect(a).rejects.toThrow('timed out after 100ms');
      } finally {
        jest.useRealTimers();
      }
    });
  });

  describe('stdout parsing', () => {
    it('reassembles messages split across chunks and handles several per chunk', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const one = server.sendRequest('one');
      const two = server.sendRequest('two');
      const text =
        JSON.stringify({ jsonrpc: '2.0', id: '1', result: 1 }) +
        '\n\n   \n' +
        JSON.stringify({ jsonrpc: '2.0', id: '2', result: 2 }) +
        '\n';

      stdout(text.slice(0, 10));
      stdout(text.slice(10, 40));
      stdout(text.slice(40));

      await expect(one).resolves.toBe(1);
      await expect(two).resolves.toBe(2);
    });

    it('waits for the newline before handling a message', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const promise = server.sendRequest('x');
      const settled = jest.fn();
      promise.then(settled, settled);

      stdout(JSON.stringify({ jsonrpc: '2.0', id: '1', result: 'r' }));
      await flush();
      expect(settled).not.toHaveBeenCalled();

      stdout('\n');
      await expect(promise).resolves.toBe('r');
    });

    it('routes log notifications to onLog', () => {
      const onLog = jest.fn();
      const server = new StdioServerProcess({ onLog });
      server.start('/ext', 'a.js');
      const params = { level: 'warn', message: 'hi', timestamp: 't' };

      stdout(JSON.stringify({ jsonrpc: '2.0', method: 'log', params }) + '\n');

      expect(onLog).toHaveBeenCalledWith(params);
    });

    it('logs and skips lines that are not JSON', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const promise = server.sendRequest('x');

      stdout('garbage\n');
      stdout(JSON.stringify({ jsonrpc: '2.0', id: '1', result: 'ok' }) + '\n');

      await expect(promise).resolves.toBe('ok');
      expect(error).toHaveBeenCalledWith(
        'Failed to parse response:',
        'garbage',
        expect.any(SyntaxError),
      );
      error.mockRestore();
    });

    it('ignores responses without an id or for unknown ids', () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');

      expect(() => {
        stdout(JSON.stringify({ jsonrpc: '2.0', id: null, result: 1 }) + '\n');
        stdout(JSON.stringify({ jsonrpc: '2.0', result: 1, x: 1 }) + '\n');
        stdout(JSON.stringify({ jsonrpc: '2.0', id: '99', result: 1 }) + '\n');
      }).not.toThrow();
    });
  });

  describe('notifications', () => {
    it('dispatches server notifications to every registered handler', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const a = jest.fn();
      const b = jest.fn();
      const other = jest.fn();
      server.onNotification('file.changed', a);
      server.onNotification('file.changed', b);
      server.onNotification('other', other);

      stdout(
        JSON.stringify({
          jsonrpc: '2.0',
          method: 'file.changed',
          params: { path: '/x' },
        }) + '\n',
      );
      await flush();

      expect(a).toHaveBeenCalledWith({ path: '/x' });
      expect(b).toHaveBeenCalledWith({ path: '/x' });
      expect(other).not.toHaveBeenCalled();
    });

    it('keeps notifying other handlers when one fails', async () => {
      const error = jest.spyOn(console, 'error').mockImplementation(() => {});
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const failure = new Error('handler failed');
      const good = jest.fn();
      server.onNotification('evt', async () => {
        throw failure;
      });
      server.onNotification('evt', good);

      stdout(JSON.stringify({ jsonrpc: '2.0', method: 'evt' }) + '\n');
      await flush();

      expect(good).toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        'Error in notification handler for "evt":',
        failure,
      );
      error.mockRestore();
    });

    it('ignores notifications nobody listens to', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');

      expect(() =>
        stdout(JSON.stringify({ jsonrpc: '2.0', method: 'nobody' }) + '\n'),
      ).not.toThrow();
      await flush();
    });

    it('unsubscribes individual handlers and tracks registered types', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const a = jest.fn();
      const b = jest.fn();
      const offA = server.onNotification('evt', a);
      const offB = server.onNotification('evt', b);
      server.onNotification('other', jest.fn());

      expect(server.getRegisteredNotifications()).toEqual(['evt', 'other']);

      offA();
      stdout(JSON.stringify({ jsonrpc: '2.0', method: 'evt' }) + '\n');
      await flush();
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);

      offB();
      expect(server.getRegisteredNotifications()).toEqual(['other']);
    });

    it('offNotification removes every handler for a type', async () => {
      const server = new StdioServerProcess();
      server.start('/ext', 'a.js');
      const a = jest.fn();
      server.onNotification('evt', a);
      server.onNotification('evt', jest.fn());

      server.offNotification('evt');
      stdout(JSON.stringify({ jsonrpc: '2.0', method: 'evt' }) + '\n');
      await flush();

      expect(a).not.toHaveBeenCalled();
      expect(server.getRegisteredNotifications()).toEqual([]);
    });
  });
});
