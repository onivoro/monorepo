import type { OutputChannel } from 'vscode';
import { logDebug } from './log-debug.function';

describe(logDebug.name, () => {
  const appendLine = jest.fn();
  const channel = { appendLine } as unknown as OutputChannel;

  beforeEach(() => {
    appendLine.mockReset();
    jest.useFakeTimers().setSystemTime(new Date('2026-01-02T03:04:05.000Z'));
  });

  afterEach(() => jest.useRealTimers());

  it('writes a timestamped debug line', () => {
    logDebug(channel, 'hello');
    expect(appendLine).toHaveBeenCalledTimes(1);
    expect(appendLine).toHaveBeenCalledWith(
      '[DEBUG 2026-01-02T03:04:05.000Z] hello',
    );
  });

  it('writes each extra argument as pretty JSON', () => {
    logDebug(channel, 'msg', { a: 1 }, [2]);
    expect(appendLine.mock.calls).toEqual([
      ['[DEBUG 2026-01-02T03:04:05.000Z] msg'],
      [JSON.stringify({ a: 1 }, null, 2)],
      [JSON.stringify([2], null, 2)],
    ]);
  });
});
