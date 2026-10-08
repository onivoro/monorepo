import { sortNumbers } from './sort-numbers.function';

describe('sortNumbers', () => {
  it('returns -1 when a < b and 1 when a > b', () => {
    expect(sortNumbers(1, 2)).toBe(-1);
    expect(sortNumbers(2, 1)).toBe(1);
  });

  it('coerces numeric strings', () => {
    expect(
      sortNumbers('10' as unknown as number, '9' as unknown as number),
    ).toBe(1);
  });

  it('sorts an array ascending', () => {
    expect([10, -1, 3, 2.5].sort(sortNumbers)).toEqual([-1, 2.5, 3, 10]);
  });

  it('returns 0 for equal values', () => {
    expect(sortNumbers(1, 1)).toBe(0);
  });
});
