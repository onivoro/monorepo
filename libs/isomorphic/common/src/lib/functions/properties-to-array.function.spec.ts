import { propertiesToArray } from './properties-to-array.function';

describe('propertiesToArray', () => {
  it('lists dotted paths to every leaf property', () => {
    expect(
      propertiesToArray({
        a: 1,
        b: { c: 2, d: { e: 3 } },
        f: [1, 2],
        g: null,
      }),
    ).toEqual(['a', 'b.c', 'b.d.e', 'f', 'g']);
  });

  it('treats arrays as leaves', () => {
    expect(propertiesToArray({ list: [{ x: 1 }] })).toEqual(['list']);
  });

  it('returns an empty array for an empty object', () => {
    expect(propertiesToArray({})).toEqual([]);
  });

  it('includes nested empty objects as nothing', () => {
    expect(propertiesToArray({ a: {} })).toEqual([]);
  });
});
