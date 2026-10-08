import { camelCase } from './camel-case.function';

describe('camelCase', () => {
  it.each([
    ['Foo Bar', 'fooBar'],
    ['--foo-bar--', 'fooBar'],
    ['__FOO_BAR__', 'fooBar'],
    ['fooBar', 'fooBar'],
    ['foo bar baz', 'fooBarBaz'],
    ["don't stop", 'dontStop'],
    ['foo2bar', 'foo2Bar'],
    ['', ''],
  ])('GIVEN %j, returns %j', (input, expected) => {
    expect(camelCase(input)).toBe(expected);
  });

  it('treats null/undefined as an empty string', () => {
    expect(camelCase(null as unknown as string)).toBe('');
    expect(camelCase(undefined as unknown as string)).toBe('');
  });
});
