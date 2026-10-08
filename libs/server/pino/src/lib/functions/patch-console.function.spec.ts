import { PinoLogger } from 'nestjs-pino';
import { patchConsole } from './patch-console.function';

describe('patchConsole', () => {
  const methods = ['debug', 'error', 'info', 'log', 'trace', 'warn'] as const;
  let originals: Record<string, unknown>;
  let logger: Record<'debug' | 'error' | 'info' | 'trace' | 'warn', jest.Mock>;
  let restore: () => void;

  beforeEach(() => {
    originals = Object.fromEntries(methods.map((m) => [m, console[m]]));
    logger = {
      debug: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
      trace: jest.fn(),
      warn: jest.fn(),
    };
    ({ restore } = patchConsole(logger as unknown as PinoLogger));
  });

  afterEach(() => {
    restore();
    methods.forEach((m) => ((console as any)[m] = originals[m]));
  });

  it.each([
    ['debug', 'debug'],
    ['error', 'error'],
    ['info', 'info'],
    ['log', 'info'],
    ['trace', 'trace'],
    ['warn', 'warn'],
  ] as const)(
    'routes console.%s to logger.%s with the args as msg',
    (consoleMethod, loggerMethod) => {
      console[consoleMethod]('a', 1, { b: 2 });

      expect(logger[loggerMethod]).toHaveBeenCalledTimes(1);
      expect(logger[loggerMethod]).toHaveBeenCalledWith({
        msg: ['a', 1, { b: 2 }],
      });
    },
  );

  it('returns the logger it patched with', () => {
    restore();
    const result = patchConsole(logger as unknown as PinoLogger);
    restore = result.restore;

    expect(result._console).toBe(logger);
  });

  it('restore puts the original console methods back', () => {
    restore();

    methods.forEach((m) => expect(console[m]).toBe(originals[m]));
  });
});
