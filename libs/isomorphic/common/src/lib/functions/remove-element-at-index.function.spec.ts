import { removeElementAtIndex } from './remove-element-at-index.function';

describe('removeElementAtIndex', () => {
  it('returns a new array without the element at the index', () => {
    const input = ['a', 'b', 'c'];
    const result = removeElementAtIndex(input, 1);

    expect(result).toEqual(['a', 'c']);
    expect(result).not.toBe(input);
    expect(input).toEqual(['a', 'b', 'c']);
  });

  it.each([-1, 3, 99])(
    'returns a copy unchanged when index %p is out of range',
    (index) => {
      expect(removeElementAtIndex(['a', 'b', 'c'], index)).toEqual([
        'a',
        'b',
        'c',
      ]);
    },
  );

  it.each([undefined, null])('returns an empty array for %p', (input) => {
    expect(removeElementAtIndex(input as unknown as string[], 0)).toEqual([]);
  });
});
