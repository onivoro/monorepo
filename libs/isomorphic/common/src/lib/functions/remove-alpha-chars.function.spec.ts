import { removeAlphaChars } from './remove-alpha-chars.function';

describe('removeAlphaChars', () => {
  it('worx', () => {
    expect(removeAlphaChars('1234.567')).toMatchSnapshot();
    expect(removeAlphaChars(987.65)).toMatchSnapshot();
    expect(removeAlphaChars('$337.65')).toMatchSnapshot();
    expect(removeAlphaChars('$1,234.56')).toMatchSnapshot();
    expect(removeAlphaChars('dollarzzz$1,234.5six')).toMatchSnapshot();
  });
});
describe('removeAlphaChars branches', () => {
  it('keeps only digits and dots', () => {
    expect(removeAlphaChars('-$1,234.56 USD')).toBe('1234.56');
  });

  it.each([undefined, '', 0])(
    'returns undefined for falsey input %p',
    (input) => {
      expect(removeAlphaChars(input)).toBeUndefined();
    },
  );

  it('returns undefined when there are no digits or dots', () => {
    expect(removeAlphaChars('abc')).toBeUndefined();
  });
});
