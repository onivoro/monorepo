import { isValidDate } from './is-valid-date.function';

describe('isValidDate', () => {
  it('returns a Date for a valid ISO string', () => {
    const result = isValidDate('2024-02-29T12:00:00.000Z');

    expect(result).toBeInstanceOf(Date);
    expect(result?.toISOString()).toBe('2024-02-29T12:00:00.000Z');
  });

  it('returns a new Date for a valid Date', () => {
    const input = new Date(0);
    const result = isValidDate(input);

    expect(result).not.toBe(input);
    expect(result?.getTime()).toBe(0);
  });

  it.each(['not a date', '', '2024-13-45'])(
    'returns undefined for invalid input %j',
    (input) => {
      expect(isValidDate(input)).toBeUndefined();
    },
  );

  it('returns undefined for an invalid Date', () => {
    expect(isValidDate(new Date(NaN))).toBeUndefined();
  });
});
