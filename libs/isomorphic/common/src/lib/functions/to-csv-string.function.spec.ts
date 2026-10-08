import { toCsvString } from './to-csv-string.function';

describe('toCsvString', () => {
  it('joins values with commas', () => {
    expect(toCsvString(['a', 'b', 'c'])).toBe('a,b,c');
  });

  it.each([undefined, []])('returns an empty string for %p', (input) => {
    expect(toCsvString(input)).toBe('');
  });
});
