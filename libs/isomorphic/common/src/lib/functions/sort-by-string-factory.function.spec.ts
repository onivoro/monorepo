import { sortByStringFactory } from './sort-by-string-factory.function';

type TItem = { s?: string | number | null };

describe('sortByStringFactory', () => {
  const compare = sortByStringFactory<TItem>('s');

  it('compares the stringified property', () => {
    expect(compare({ s: 'a' }, { s: 'b' })).toBeLessThan(0);
    expect(compare({ s: 'b' }, { s: 'a' })).toBeGreaterThan(0);
    expect(compare({ s: 'a' }, { s: 'a' })).toBe(0);
    expect(compare({ s: 10 }, { s: 9 })).toBeLessThan(0);
  });

  it('returns 0 when the left value is missing', () => {
    expect(compare({}, { s: 'a' })).toBe(0);
    expect(compare({ s: null }, { s: 'a' })).toBe(0);
  });

  it('treats a missing right value as an empty string', () => {
    expect(compare({ s: 'a' }, {})).toBeGreaterThan(0);
  });
});
