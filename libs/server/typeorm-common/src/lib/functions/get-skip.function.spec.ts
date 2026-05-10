import { getSkip } from './get-skip.function';

describe(getSkip.name, () => {
  it('returns 0 when pagingKey is 0', () => {
    expect(getSkip(0, 10)).toBe(0);
  });

  it('returns 0 when pagingKey is undefined (treated as falsy)', () => {
    expect(getSkip(undefined as any, 10)).toBe(0);
  });

  it('returns 0 when pagingKey is "" (treated as falsy)', () => {
    expect(getSkip('', 10)).toBe(0);
  });

  it('multiplies numeric pagingKey by pageSize', () => {
    expect(getSkip(3, 25)).toBe(75);
  });

  it('coerces string pagingKey via Number()', () => {
    expect(getSkip('2', 25)).toBe(50);
  });
});
