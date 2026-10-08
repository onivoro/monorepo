import { kebabCase } from './kebab-case.function';

describe('kebabCase', () => {
  it.each([
    ['Foo Bar', 'foo-bar'],
    ['fooBar', 'foo-bar'],
    ['__FOO_BAR__', 'foo-bar'],
    ['foo2bar', 'foo-2-bar'],
    ['', ''],
  ])('GIVEN %j, returns %j', (input, expected) => {
    expect(kebabCase(input)).toBe(expected);
  });
});
