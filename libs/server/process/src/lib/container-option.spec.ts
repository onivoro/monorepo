import { EventEmitter } from 'events';
import { exec, spawn } from 'child_process';
import { lastValueFrom } from 'rxjs';
import { execPromise } from './exec-promise';
import { execRx } from './exec-rx';
import { spawnPromise } from './spawn-promise';

jest.mock('child_process', () => ({
  exec: jest.fn(),
  spawn: jest.fn(),
}));

/** A child process that exits 0 on the next tick without printing anything. */
function fakeChild() {
  const child = Object.assign(new EventEmitter(), {
    stdout: new EventEmitter(),
    stderr: new EventEmitter(),
    killed: false,
    kill: jest.fn(),
  });
  setImmediate(() => child.emit('close', 0));
  return child;
}

describe('the container option', () => {
  beforeEach(() => {
    jest.mocked(exec).mockReset();
    jest.mocked(spawn).mockReset();
    jest.mocked(spawn).mockImplementation((() => fakeChild()) as any);
    jest.mocked(exec).mockImplementation(((
      cmd: string,
      options: unknown,
      callback: any,
    ) => {
      callback(null, 'out', '');
    }) as any);
  });

  describe('execPromise', () => {
    it('wraps the command in docker exec and strips container from the exec options', async () => {
      await execPromise('ls -la', { container: 'web', cwd: '/srv' });

      expect(exec).toHaveBeenCalledWith(
        'docker exec web ls -la',
        { cwd: '/srv' },
        expect.any(Function),
      );
    });

    it('runs the command as-is without a container', async () => {
      await execPromise('ls');

      expect(exec).toHaveBeenCalledWith('ls', {}, expect.any(Function));
    });
  });

  describe('execRx', () => {
    it('wraps the command in docker exec and runs it in a shell', async () => {
      await lastValueFrom(
        execRx('cat /etc/hosts', { container: 'db', cwd: '/tmp' }),
        {
          defaultValue: undefined,
        },
      );

      expect(spawn).toHaveBeenCalledWith('docker exec db cat /etc/hosts', [], {
        shell: true,
        cwd: '/tmp',
      });
    });
  });

  describe('spawnPromise', () => {
    it('runs the program through docker exec, preserving its args', async () => {
      await spawnPromise('ls', ['-la', '/'], {
        container: 'web',
        env: { A: '1' },
      });

      expect(spawn).toHaveBeenCalledWith(
        'docker',
        ['exec', 'web', 'ls', '-la', '/'],
        {
          env: { A: '1' },
        },
      );
    });

    it('handles a container with no args', async () => {
      await spawnPromise('ps', undefined, { container: 'web' });

      expect(spawn).toHaveBeenCalledWith('docker', ['exec', 'web', 'ps'], {});
    });
  });
});
