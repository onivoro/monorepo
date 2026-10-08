import { mapEnumToLookupArray } from './map-enum-to-lookup-array.function';

enum Color {
  Red = 'red',
  Dark_Blue = 'dark-blue',
  Very_Light_Green = 'vlg',
}

describe('mapEnumToLookupArray', () => {
  it('maps entries to lookups, replacing underscores in keys with spaces', () => {
    expect(mapEnumToLookupArray(Color)).toEqual([
      { value: 'red', display: 'Red' },
      { value: 'dark-blue', display: 'Dark Blue' },
      { value: 'vlg', display: 'Very Light Green' },
    ]);
  });

  it('returns an empty array for an empty object', () => {
    expect(mapEnumToLookupArray({})).toEqual([]);
  });
});
