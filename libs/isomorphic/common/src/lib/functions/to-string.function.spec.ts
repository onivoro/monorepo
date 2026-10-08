import { toString } from './to-string.function';

describe('toString', () => {
  it.each([
    [null, ''],
    [undefined, ''],
    ['abc', 'abc'],
    [123, '123'],
    [0, '0'],
    [-0, '-0'],
    [true, 'true'],
    [[1, 2, 3], '1,2,3'],
    [[1, null, undefined, 'a'], '1,,,a'],
    [[[1, 2], [3]], '1,2,3'],
    [[-0], '-0'],
  ])('GIVEN %p, returns %j', (input, expected) => {
    expect(toString(input)).toBe(expected);
  });

  it('converts symbols', () => {
    expect(toString(Symbol('x'))).toBe('Symbol(x)');
  });

  it('converts objects using their template-literal representation', () => {
    expect(toString({ toString: () => 'custom' })).toBe('custom');
  });
});
