import { isSymbol } from './is-symbol.function';

describe('isSymbol', () => {
  it('returns true for primitive symbols', () => {
    expect(isSymbol(Symbol('a'))).toBe(true);
  });

  it('returns true for boxed symbols', () => {
    expect(isSymbol(Object(Symbol('a')))).toBe(true);
  });

  it.each([null, undefined, 'symbol', 1, {}, [], () => undefined])(
    'returns false for %p',
    (value) => {
      expect(isSymbol(value)).toBe(false);
    },
  );
});
