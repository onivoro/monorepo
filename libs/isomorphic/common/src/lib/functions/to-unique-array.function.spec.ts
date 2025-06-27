import { toUniqueArray } from './to-unique-array.function';

describe('toUniqueArray', () => {
  it.each([
    [
      [1, 2, 3],
      [1, 2, 3],
    ],
    [[1, 1, 1], [1]],
  ])(
    'GIVEN array of numbers: %j, returns a unique array without duplicate elements',
    (array, expected) => {
      expect(toUniqueArray(array)).toEqual(expected);
    }
  );

  it.each([
    [
      ['one', 'two', 'three'],
      ['one', 'two', 'three'],
    ],
    [['one', 'one', 'one'], ['one']],
  ])(
    'GIVEN array of strings: %j, returns a unique array without duplicate elements',
    (array, expected) => {
      expect(toUniqueArray(array)).toEqual(expected);
    }
  );

  it.each([
    [
      ['one', 'two', 'three', undefined, undefined],
      ['one', 'two', 'three', undefined],
    ],
    [
      ['one', 'one', 'one', null, null],
      ['one', null],
    ],
  ])(
    'GIVEN array with falsey values: %j, returns a unique array without duplicate elements including falsey values',
    (array, expected) => {
      expect(toUniqueArray(array)).toEqual(expected);
    }
  );
});
