import { mapEnumToArrayOfValues } from './map-enum-to-array-of-values.function';

enum Color {
  Red = 'red',
  Dark_Blue = 'dark-blue',
}

enum Level {
  Low = 1,
  High = 2,
}

describe('mapEnumToArrayOfValues', () => {
  it('returns the values of a string enum', () => {
    expect(mapEnumToArrayOfValues(Color)).toEqual(['red', 'dark-blue']);
  });

  it('stringifies values of a numeric enum (including reverse mappings)', () => {
    expect(mapEnumToArrayOfValues(Level)).toEqual(['Low', 'High', '1', '2']);
  });

  it('stringifies values of a plain object', () => {
    expect(mapEnumToArrayOfValues({ a: 1, b: true, c: 'x' })).toEqual([
      '1',
      'true',
      'x',
    ]);
  });
});
