import { getPagingKey } from './get-paging-key.function';
import { getSkip } from './get-skip.function';

describe(getPagingKey.name, () => {
  it('returns 1 when page 1 has more data to fetch', () => {
    // page 1: pagingKey=0 → skip=0 → fetched rows [0..pageSize)
    expect(getPagingKey(10, 0, 25)).toBe(1);
  });

  it('returns 2 when page 2 has more data to fetch', () => {
    // page 2: pagingKey=1 → skip=10 → fetched rows [10..20)
    expect(getPagingKey(10, 10, 25)).toBe(2);
  });

  it('returns undefined when the current page is the last', () => {
    // page 3: pagingKey=2 → skip=20 → fetched rows [20..25), no more
    expect(getPagingKey(10, 20, 25)).toBeUndefined();
  });

  it('returns undefined when the page exactly fills the result set', () => {
    expect(getPagingKey(10, 0, 10)).toBeUndefined();
    expect(getPagingKey(10, 10, 20)).toBeUndefined();
  });

  it('returns undefined when the table is empty', () => {
    expect(getPagingKey(10, 0, 0)).toBeUndefined();
  });

  it('round-trips with getSkip across multiple pages', () => {
    const pageSize = 25;
    const total = 120;

    // Simulate a client paginating from page 1 to exhaustion.
    let pagingKey: number | undefined = 0;
    const visited: number[] = [];

    while (pagingKey !== undefined) {
      const skip = getSkip(pagingKey, pageSize);
      visited.push(skip);
      pagingKey = getPagingKey(pageSize, skip, total);
    }

    // Expect skips 0, 25, 50, 75, 100 — five pages covering 120 rows.
    expect(visited).toEqual([0, 25, 50, 75, 100]);
  });
});
