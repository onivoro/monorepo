import { toBooleanString } from './to-boolean-string.function';

describe('toBooleanString', () => {
  it.each([
    [true, 'true'],
    [false, 'false'],
    [undefined, 'false'],
  ])('GIVEN %p, returns %j', (input, expected) => {
    expect(toBooleanString(input)).toBe(expected);
  });
});
