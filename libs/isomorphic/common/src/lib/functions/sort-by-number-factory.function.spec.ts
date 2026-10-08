import { sortByNumberFactory } from './sort-by-number-factory.function';

type TItem = { n?: number | null };

describe('sortByNumberFactory', () => {
  const compare = sortByNumberFactory<TItem>('n');

  it('returns -1, 0, 1 according to the property', () => {
    expect(compare({ n: 1 }, { n: 2 })).toBe(-1);
    expect(compare({ n: 2 }, { n: 1 })).toBe(1);
    expect(compare({ n: 3 }, { n: 3 })).toBe(0);
  });

  it('treats missing/null values as 0', () => {
    expect(compare({}, { n: 0 })).toBe(0);
    expect(compare({ n: null }, { n: 1 })).toBe(-1);
    expect(compare({ n: -1 }, {})).toBe(-1);
  });

  it('sorts an array ascending', () => {
    const items: TItem[] = [{ n: 3 }, { n: 1 }, {}, { n: 2 }];
    expect(items.sort(compare).map((i) => i.n)).toEqual([undefined, 1, 2, 3]);
  });
});
