jest.mock('child_process', () => ({ execSync: jest.fn() }));

import { execSync } from 'child_process';
import { shell } from './shell.function';

describe('shell', () => {
  let log: jest.SpyInstance;

  beforeEach(() => {
    log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    (execSync as jest.Mock).mockReset();
  });

  afterEach(() => {
    log.mockRestore();
  });

  it('runs the command synchronously, logs it, and returns stdout as a string', () => {
    (execSync as jest.Mock).mockReturnValue(Buffer.from('hello'));

    expect(shell('echo hello')).toBe('hello');
    expect(execSync).toHaveBeenCalledWith('echo hello');
    expect(log).toHaveBeenCalledWith('\necho hello');
    expect(log).toHaveBeenCalledWith('hello\n');
  });

  it('propagates command failures', () => {
    (execSync as jest.Mock).mockImplementation(() => {
      throw new Error('exit 1');
    });

    expect(() => shell('false')).toThrow('exit 1');
  });
});
