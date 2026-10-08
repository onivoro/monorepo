import { tmpdir } from 'os';
import { realpathSync } from 'fs';
import { lastValueFrom } from 'rxjs';
import { reduce } from 'rxjs/operators';
import { execPromise } from './exec-promise';
import { execRx } from './exec-rx';
import { spawnPromise } from './spawn-promise';

const node = JSON.stringify(process.execPath);
const tmp = realpathSync(tmpdir());

const collect = (cmd: string, options?: Parameters<typeof execRx>[1]) =>
  lastValueFrom(
    execRx(cmd, options).pipe(reduce((acc, chunk) => acc + chunk, '')),
  );

describe('process helpers with local commands', () => {
  describe('execPromise', () => {
    it('resolves with stdout and stderr separately', async () => {
      const result = await execPromise(
        `${node} -e "process.stdout.write('out'); process.stderr.write('err')"`,
      );

      expect(result).toEqual({ stdout: 'out', stderr: 'err' });
    });

    it('passes exec options through', async () => {
      const { stdout } = await execPromise(
        `${node} -e "process.stdout.write(process.cwd())"`,
        {
          cwd: tmp,
        },
      );

      expect(realpathSync(stdout)).toBe(tmp);
    });

    it('rejects with the exit code on failure', async () => {
      await expect(
        execPromise(`${node} -e "process.exit(4)"`),
      ).rejects.toMatchObject({ code: 4 });
    });
  });

  describe('execRx', () => {
    it('includes stderr in the output by default', async () => {
      await expect(
        collect(`${node} -e "process.stderr.write('warned')"`),
      ).resolves.toBe('warned');
    });

    it('errors with the exit code on a non-zero exit', async () => {
      await expect(collect(`${node} -e "process.exit(2)"`)).rejects.toThrow(
        'Process exited with code 2',
      );
    });

    it('passes spawn options such as env through', async () => {
      await expect(
        collect(`${node} -e "process.stdout.write(process.env.PROC_TEST)"`, {
          env: { ...process.env, PROC_TEST: 'from-env' },
        }),
      ).resolves.toBe('from-env');
    });

    it('errors when the process cannot be spawned', async () => {
      await expect(
        collect('echo hi', { cwd: '/definitely/not/a/dir' }),
      ).rejects.toMatchObject({
        code: 'ENOENT',
      });
    });
  });

  describe('spawnPromise', () => {
    it('resolves with the concatenated stdout of a program', async () => {
      await expect(
        spawnPromise(process.execPath, [
          '-e',
          'console.log("a"); console.log("b")',
        ]),
      ).resolves.toBe('a\nb\n');
    });

    it('passes args verbatim without a shell', async () => {
      await expect(
        spawnPromise(process.execPath, [
          '-e',
          'process.stdout.write(process.argv[1])',
          '$HOME; echo no',
        ]),
      ).resolves.toBe('$HOME; echo no');
    });

    it('rejects with stderr when the program exits non-zero', async () => {
      await expect(
        spawnPromise(process.execPath, [
          '-e',
          'process.stderr.write("bad input"); process.exit(1)',
        ]),
      ).rejects.toThrow('bad input');
    });

    it('runs with no args', async () => {
      await expect(spawnPromise('pwd', undefined, { cwd: tmp })).resolves.toBe(
        `${tmp}\n`,
      );
    });
  });
});
