import { toWords } from './to-words.function';

describe('toWords', () => {
  it('worx', () => {
    expect(toWords(337)).toMatchSnapshot();
  });
});

describe('toWords conversions', () => {
  it.each([
    [0, 'zero'],
    [7, 'seven'],
    [13, 'thirteen'],
    [20, 'twenty'],
    [42, 'forty-two'],
    [100, 'one hundred'],
    [101, 'one hundred one'],
    [999, 'nine hundred ninety-nine'],
    [1000, 'one thousand'],
    [1234, 'one thousand, two hundred thirty-four'],
    [1000000, 'one million'],
    [2000001, 'two million, one'],
    [3000000000, 'three billion'],
    [4000000000000, 'four trillion'],
    [5000000000000000, 'five quadrillion'],
    ['12', 'twelve'],
    ['$1,000', 'one thousand'],
    [12.9, 'twelve'],
  ])('toWords(%p) === %j', (input, expected) => {
    expect(toWords(input)).toBe(expected);
  });

  it('treats input without digits as zero', () => {
    expect(toWords('abc')).toBe('zero');
  });

  it('throws a TypeError when the input is not a finite number', () => {
    expect(() => toWords('.')).toThrow(TypeError);
  });

  it('throws a RangeError for unsafe integers', () => {
    expect(() => toWords('9007199254740993')).toThrow(RangeError);
  });
});
