import { sortByName } from './sort-by-name.function';

describe('sortByName', () => {
  it('compares names', () => {
    expect(sortByName({ name: 'a' }, { name: 'b' })).toBeLessThan(0);
    expect(sortByName({ name: 'b' }, { name: 'a' })).toBeGreaterThan(0);
    expect(sortByName({ name: 'a' }, { name: 'a' })).toBe(0);
  });

  it('returns 0 when the left side has no name', () => {
    expect(sortByName({} as { name: string }, { name: 'a' })).toBe(0);
    expect(
      sortByName(undefined as unknown as { name: string }, { name: 'a' }),
    ).toBe(0);
  });

  it('treats a missing right-hand name as an empty string', () => {
    expect(sortByName({ name: 'a' }, {} as { name: string })).toBeGreaterThan(
      0,
    );
  });

  it('sorts an array', () => {
    const items = [{ name: 'c' }, { name: 'a' }, { name: 'b' }];
    expect(items.sort(sortByName).map((i) => i.name)).toEqual(['a', 'b', 'c']);
  });
});
