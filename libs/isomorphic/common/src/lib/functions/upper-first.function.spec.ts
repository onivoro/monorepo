import { upperFirst } from './upper-first.function';

describe('upperFirst', () => {
  it.each([
    ['asdf', 'Asdf'],
    ['XCVB', 'Xcvb'],
  ])('GIVEN %j, returns %j', (input, expected) => {
    expect(upperFirst(input)).toBe(expected);
  });

  it.each([null, undefined, 0, false])(
    'GIVEN falsey input %j, returns it unchanged',
    (input) => {
      // upperFirst is typed (string) => string; these non-string falsey values
      // exercise its runtime guard, so cast past the compiler.
      expect(upperFirst(input as unknown as string)).toBe(input);
    },
  );

  it('upper-cases the first character and lower-cases the rest', () => {
    expect(upperFirst('hELLO wORLD')).toBe('Hello world');
  });

  it('returns an empty string unchanged', () => {
    expect(upperFirst('')).toBe('');
  });

  it('handles a single character', () => {
    expect(upperFirst('a')).toBe('A');
  });
});
