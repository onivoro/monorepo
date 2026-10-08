import {
  AGENTIC_HISTORY_LIMIT_MAX,
  parseAgenticHistoryLimit,
} from './parse-agentic-history-limit';

describe(parseAgenticHistoryLimit.name, () => {
  it.each([undefined, '', 'abc', '0', '-3', 'Infinity'])(
    'falls back to undefined for %p',
    (value) => {
      expect(parseAgenticHistoryLimit(value)).toBeUndefined();
    },
  );

  it('truncates fractional limits', () => {
    expect(parseAgenticHistoryLimit('12.9')).toBe(12);
  });

  it('clamps limits to the maximum', () => {
    expect(parseAgenticHistoryLimit('100000')).toBe(AGENTIC_HISTORY_LIMIT_MAX);
    expect(parseAgenticHistoryLimit(String(AGENTIC_HISTORY_LIMIT_MAX))).toBe(
      100,
    );
  });
});
