import { fromCsvString } from './from-csv-string.function';

describe('fromCsvString', () => {
  it('splits on commas and trims each value', () => {
    expect(fromCsvString(' a, b ,c ')).toEqual(['a', 'b', 'c']);
  });

  it('keeps empty segments', () => {
    expect(fromCsvString('a,,b')).toEqual(['a', '', 'b']);
  });

  it.each([undefined, ''])('returns an empty array for %p', (input) => {
    expect(fromCsvString(input)).toEqual([]);
  });
});
