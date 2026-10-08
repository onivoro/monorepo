import { chunk } from './chunk.function';
import { arrangeActAssert } from '../functions/arrange-act-assert.function';

const array = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

describe('chunk', () => {
  it.each([[1], [2], [3], [4], [5]])(
    'given %j, returns an array of arrays',
    async (_) =>
      await arrangeActAssert({
        arrange: () => ({ subject: chunk }),
        act: ({ subject }) => subject(array, _),
        assert: ({ result }) => {
          expect(result).toMatchSnapshot();
        },
      }),
  );
});
describe('chunk behaviour', () => {
  it('splits into at most numDivisions chunks, preserving order', () => {
    expect(chunk([1, 2, 3, 4, 5, 6], 3)).toEqual([
      [1, 2],
      [3, 4],
      [5, 6],
    ]);
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([
      [1, 2, 3],
      [4, 5],
    ]);
  });

  it('returns one chunk per element when numDivisions exceeds length', () => {
    expect(chunk([1, 2], 5)).toEqual([[1], [2]]);
  });

  it('returns a single chunk when numDivisions is 1', () => {
    expect(chunk([1, 2, 3], 1)).toEqual([[1, 2, 3]]);
  });

  it('returns an empty array for an empty input', () => {
    expect(chunk([], 3)).toEqual([]);
  });

  it.each([0, -1])('throws when numDivisions is %p', (n) => {
    expect(() => chunk([1, 2, 3], n)).toThrow(Error);
  });
});
