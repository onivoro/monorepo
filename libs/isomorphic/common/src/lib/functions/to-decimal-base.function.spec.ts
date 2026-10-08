import { toDecimalBase } from './to-decimal-base.function';

describe('toDecimalBase', () => {
  it.each([
    ['ff', 16, 255],
    ['FF', 16, 255],
    ['1a', 16, 26],
    ['A0', 16, 160],
    ['0', 16, 0],
    ['101', 2, 5],
    ['777', 8, 511],
    ['z', 36, 35],
    ['Z', 36, 35],
  ])('toDecimalBase(%j, %p) === %p', (input, base, expected) => {
    expect(toDecimalBase(input, base)).toBe(expected);
  });

  it('defaults to base 16', () => {
    expect(toDecimalBase('10')).toBe(16);
  });

  it('accepts numbers', () => {
    expect(toDecimalBase(10, 2)).toBe(2);
    expect(toDecimalBase(10, 10)).toBe(10);
  });
});
