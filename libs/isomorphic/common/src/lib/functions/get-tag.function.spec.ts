import { getTag } from './get-tag.function';

describe('getTag', () => {
  it.each([
    [undefined, '[object Undefined]'],
    [null, '[object Null]'],
    ['a', '[object String]'],
    [1, '[object Number]'],
    [true, '[object Boolean]'],
    [[], '[object Array]'],
    [{}, '[object Object]'],
    [new Date(0), '[object Date]'],
    [Symbol('s'), '[object Symbol]'],
  ])('GIVEN %p, returns %j', (value, expected) => {
    expect(getTag(value)).toBe(expected);
  });
});
