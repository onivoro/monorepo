import { parseCsvString } from './parse-csv-string.function';

describe(parseCsvString.name, () => {
  it.each([
    ['a,b,c', ['a', 'b', 'c']],
    [' a , b ,c ', ['a', 'b', 'c']],
    ['a,,b,', ['a', 'b']],
    ['single', ['single']],
    [' , ', []],
  ])('parses "%s"', (input, expected) => {
    expect(parseCsvString(input)).toEqual(expected);
  });

  it.each([[''], [undefined]])('returns [] for %j', (input) => {
    expect(parseCsvString(input)).toEqual([]);
  });
});
