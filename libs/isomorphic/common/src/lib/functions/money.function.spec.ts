import { money } from './money.function';

describe('money', () => {
  it('worx', () => {
    expect(money('1234.567')).toMatchSnapshot();
    expect(money(987.65)).toMatchSnapshot();
    expect(money('$337.65')).toMatchSnapshot();
    expect(money('$1,234.56')).toMatchSnapshot();
  });
});
describe('money edge cases', () => {
  it('rounds to cents', () => {
    expect(money('12.346')).toBe('$12.35');
    expect(money(7)).toBe('$7.00');
  });

  it.each([undefined, null, ''])(
    'returns undefined for empty input %p',
    (input) => {
      expect(money(input as unknown as string)).toBeUndefined();
    },
  );

  it('returns undefined when the input has no digits', () => {
    expect(money('abc')).toBeUndefined();
  });

  it('returns undefined when the scrubbed value is not a number', () => {
    expect(money('1.2.3')).toBeUndefined();
  });

  it('formats zero', () => {
    expect(money(0)).toBe('$0.00');
  });
});
