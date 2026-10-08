import { mapEnumToOptions } from './map-enum-to-options.function';

enum Color {
  Red = 'red',
  Dark_Blue = 'dark-blue',
}

describe('mapEnumToOptions', () => {
  it('prepends a blank option by default', () => {
    expect(mapEnumToOptions(Color)).toEqual([
      { display: '', value: '' },
      { value: 'red', display: 'Red' },
      { value: 'dark-blue', display: 'Dark Blue' },
    ]);
  });

  it('omits the blank option when includeBlank is false', () => {
    expect(mapEnumToOptions(Color, false)).toEqual([
      { value: 'red', display: 'Red' },
      { value: 'dark-blue', display: 'Dark Blue' },
    ]);
  });
});
