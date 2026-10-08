import { snakeCase } from './snake-case.function';

describe('snakeCase', () => {
  it.each([
    ['Foo Bar', 'foo_bar'],
    ['fooBar', 'foo_bar'],
    ['--FOO-BAR--', 'foo_bar'],
    ['foo2bar', 'foo_2_bar'],
    ["it's here", 'its_here'],
    ['XMLHttpRequest', 'xml_http_request'],
    ['', ''],
  ])('GIVEN %j, returns %j', (input, expected) => {
    expect(snakeCase(input)).toBe(expected);
  });
});
