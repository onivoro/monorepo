import { formatUsd } from './format-usd.function';

describe('formatUsd', () => {
  it.each([
    [1234.567, '$1,234.57'],
    ['1234.5', '$1,234.50'],
    [0, '$0.00'],
    [-5, '-$5.00'],
  ])('GIVEN %p, returns %j', (input, expected) => {
    expect(formatUsd(input)).toBe(expected);
  });

  it.each([undefined, '', 'abc', '$12'])(
    'GIVEN non-numeric %p, formats zero',
    (input) => {
      expect(formatUsd(input)).toBe('$0.00');
    },
  );
});
