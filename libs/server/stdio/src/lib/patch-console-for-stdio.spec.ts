import {
  isConsolePatched,
  patchConsoleForStdio,
  restoreConsole,
} from './patch-console-for-stdio';

describe('patchConsoleForStdio', () => {
  const NOW = '2026-01-02T03:04:05.000Z';
  let write: jest.SpyInstance;
  let errWrite: jest.SpyInstance;
  let processOn: jest.SpyInstance;
  let perfNow: jest.SpyInstance;
  let originalLog: typeof console.log;

  const logs = () =>
    write.mock.calls.map(([chunk]) => {
      expect(chunk).toMatch(/\n$/);
      return JSON.parse(chunk as string);
    });

  const messages = () =>
    logs().map(({ params }) => [params.level, params.message]);

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(NOW));
    originalLog = console.log;
    write = jest.spyOn(process.stdout, 'write').mockImplementation(() => true);
    errWrite = jest
      .spyOn(process.stderr, 'write')
      .mockImplementation(() => true);
    processOn = jest
      .spyOn(process, 'on')
      .mockImplementation(() => process as never);
    perfNow = jest.spyOn(performance, 'now');
    patchConsoleForStdio();
  });

  afterEach(() => {
    restoreConsole();
    write.mockRestore();
    errWrite.mockRestore();
    processOn.mockRestore();
    perfNow.mockRestore();
    jest.useRealTimers();
  });

  it('marks the console as patched and restores on process exit', () => {
    expect(isConsolePatched()).toBe(true);
    expect(processOn).toHaveBeenCalledWith('exit', restoreConsole);
  });

  it('writes console.log as a JSON-RPC log notification on stdout', () => {
    console.log('Server started', 42);

    expect(logs()).toEqual([
      {
        jsonrpc: '2.0',
        method: 'log',
        params: { level: 'info', message: 'Server started 42', timestamp: NOW },
      },
    ]);
    expect(errWrite).not.toHaveBeenCalled();
  });

  it('maps each logging method to its level', () => {
    console.log('l');
    console.info('i');
    console.warn('w');
    console.error('e');
    console.debug('d');
    console.trace('t');

    expect(messages()).toEqual([
      ['info', 'l'],
      ['info', 'i'],
      ['warn', 'w'],
      ['error', 'e'],
      ['debug', 'd'],
      ['debug', 't'],
    ]);
  });

  it('formats null, undefined, objects and errors', () => {
    const error = new TypeError('bad type');
    console.log(null, undefined, { a: 1 }, error);

    expect(messages()[0][1]).toBe(
      `null undefined {\n  "a": 1\n} TypeError: bad type\n${error.stack}`,
    );
  });

  it('formats an error without a stack', () => {
    const error = new Error('no stack');
    error.stack = undefined;
    console.log(error);

    expect(messages()[0][1]).toBe('Error: no stack');
  });

  it('falls back to String() for objects that cannot be serialised', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    console.log(circular);

    expect(messages()[0][1]).toBe('[object Object]');
  });

  describe('assert', () => {
    it('logs nothing when the condition holds', () => {
      console.assert(true, 'fine');
      expect(write).not.toHaveBeenCalled();
    });

    it('logs the message as an error when the condition fails', () => {
      console.assert(false, 'x was', 3);
      expect(messages()).toEqual([['error', 'Assertion failed: x was 3']]);
    });

    it('uses a default message when none is given', () => {
      console.assert(false);
      expect(messages()).toEqual([
        ['error', 'Assertion failed: Assertion failed'],
      ]);
    });
  });

  it('counts per label and resets', () => {
    console.count();
    console.count();
    console.count('a');
    console.countReset();
    console.count();

    expect(messages()).toEqual([
      ['info', 'default: 1'],
      ['info', 'default: 2'],
      ['info', 'a: 1'],
      ['info', 'default: 1'],
    ]);
  });

  describe('timers', () => {
    it('logs elapsed time on timeLog and timeEnd, then forgets the timer', () => {
      perfNow
        .mockReturnValueOnce(100)
        .mockReturnValueOnce(150.5)
        .mockReturnValueOnce(200.1234);

      console.time('load');
      console.timeLog('load', 'halfway', { step: 1 });
      console.timeEnd('load');
      console.timeEnd('load');
      console.timeLog('load');

      expect(messages()).toEqual([
        ['info', 'load: 50.500ms halfway {\n  "step": 1\n}'],
        ['info', 'load: 100.123ms'],
      ]);
    });

    it('uses the default label and omits extras when none are given', () => {
      perfNow.mockReturnValueOnce(0).mockReturnValueOnce(1);

      console.time();
      console.timeLog();

      expect(messages()).toEqual([['info', 'default: 1.000ms']]);
    });

    it('ignores unknown timers', () => {
      console.timeEnd('never');
      console.timeLog('never');
      expect(write).not.toHaveBeenCalled();
    });
  });

  it('logs group labels and ignores empty groups and groupEnd', () => {
    console.group('Outer');
    console.group();
    console.groupCollapsed('Inner', 1);
    console.groupCollapsed();
    console.groupEnd();

    expect(messages()).toEqual([
      ['info', '▼ Outer'],
      ['info', '▶ Inner 1'],
    ]);
  });

  it('logs table, dir and dirxml as formatted info', () => {
    console.table([{ a: 1 }]);
    console.dir({ b: 2 });
    console.dirxml('x', 'y');

    expect(messages()).toEqual([
      ['info', '[\n  {\n    "a": 1\n  }\n]'],
      ['info', '{\n  "b": 2\n}'],
      ['info', 'x y'],
    ]);
  });

  it('treats clear as a no-op', () => {
    console.clear();
    expect(write).not.toHaveBeenCalled();
  });

  it('does not patch twice', () => {
    const patchedLog = console.log;

    patchConsoleForStdio();

    expect(console.log).toBe(patchedLog);
    expect(errWrite).toHaveBeenCalledWith(
      '[onivoro-stdio] Console already patched for stdio; skipping duplicate patch\n',
    );
    expect(processOn).toHaveBeenCalledTimes(1);
  });

  it('shares its state across module copies through a global symbol', () => {
    jest.isolateModules(() => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const copy = require('./patch-console-for-stdio');
      expect(copy.isConsolePatched()).toBe(true);
    });
  });

  describe('restoreConsole', () => {
    it('puts the original methods back and clears the patch', () => {
      const patchedLog = console.log;

      restoreConsole();

      expect(isConsolePatched()).toBe(false);
      expect(console.log).not.toBe(patchedLog);
      // restored methods are bound copies of the originals
      expect(console.log.name).toBe(`bound ${originalLog.name}`);
    });

    it('is a no-op when the console is not patched', () => {
      restoreConsole();
      const log = console.log;

      restoreConsole();

      expect(console.log).toBe(log);
      expect(isConsolePatched()).toBe(false);
    });

    it('resets counters so a later patch starts fresh', () => {
      console.count('x');
      restoreConsole();
      patchConsoleForStdio();
      console.count('x');

      expect(messages()).toEqual([
        ['info', 'x: 1'],
        ['info', 'x: 1'],
      ]);
    });
  });
});
