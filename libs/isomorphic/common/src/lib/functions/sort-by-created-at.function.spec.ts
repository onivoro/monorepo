import { sortByCreatedAt } from './sort-by-created-at.function';

describe('sortByCreatedAt', () => {
  it('orders earlier createdAt first (Dates)', () => {
    const a = { createdAt: new Date('2024-01-01T00:00:00Z') };
    const b = { createdAt: new Date('2024-01-02T00:00:00Z') };

    expect(sortByCreatedAt(a, b)).toBe(-1);
    expect(sortByCreatedAt(b, a)).toBe(1);
    expect([b, a].sort(sortByCreatedAt)).toEqual([a, b]);
  });

  it('orders ISO strings lexically', () => {
    const items = [
      { createdAt: '2024-03-01' },
      { createdAt: '2023-12-31' },
      { createdAt: '2024-01-15' },
    ];

    expect(items.sort(sortByCreatedAt).map((i) => i.createdAt)).toEqual([
      '2023-12-31',
      '2024-01-15',
      '2024-03-01',
    ]);
  });
});
