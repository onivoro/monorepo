import { parseBool } from './parse-bool.function';

describe('parseBool', () => {
  it.each([
    [true, true],
    ['true', true],
    [false, false],
    ['false', false],
    ['TRUE', false],
    ['yes', false],
    ['', false],
    [null, false],
    [undefined, false],
  ])('GIVEN %p, returns %p', (input, expected) => {
    expect(parseBool(input)).toBe(expected);
  });
});
