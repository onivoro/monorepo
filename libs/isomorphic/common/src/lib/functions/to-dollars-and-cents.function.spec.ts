import { toDollarsAndCents } from './to-dollars-and-cents.function';

describe('toDollarsAndCents', () => {
  it('worx', () => {
    expect(toDollarsAndCents(337.33)).toMatchSnapshot();
  });
});

describe('toDollarsAndCents conversions', () => {
  it.each([
    [12, 'twelve dollars'],
    ['12.00', 'twelve dollars'],
    [12.5, 'twelve dollars and fifty cents'],
    [
      '$1,234.07',
      'one thousand, two hundred thirty-four dollars and seven cents',
    ],
    [0.99, 'zero dollars and ninety-nine cents'],
  ])('toDollarsAndCents(%p) === %j', (input, expected) => {
    expect(toDollarsAndCents(input)).toBe(expected);
  });
});
