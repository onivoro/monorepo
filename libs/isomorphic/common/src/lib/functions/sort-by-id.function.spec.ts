import { sortById } from './sort-by-id.function';

describe('sortById', () => {
  it('compares ids', () => {
    expect(sortById({ id: 'a' }, { id: 'b' })).toBeLessThan(0);
    expect(sortById({ id: 'b' }, { id: 'a' })).toBeGreaterThan(0);
    expect(sortById({ id: 'a' }, { id: 'a' })).toBe(0);
  });

  it('returns 0 when the left side has no id', () => {
    expect(sortById({} as { id: string }, { id: 'a' })).toBe(0);
    expect(sortById(undefined as unknown as { id: string }, { id: 'a' })).toBe(
      0,
    );
  });

  it('treats a missing right-hand id as an empty string', () => {
    expect(sortById({ id: 'a' }, {} as { id: string })).toBeGreaterThan(0);
    expect(
      sortById({ id: 'a' }, undefined as unknown as { id: string }),
    ).toBeGreaterThan(0);
  });
});
