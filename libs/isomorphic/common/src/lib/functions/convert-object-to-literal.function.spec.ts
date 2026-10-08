import { convertObjectToLiteral } from './convert-object-to-literal.function';

const qty = 337;
const price = 100;
const product = 'flux-capacitor';

describe('convertObjectToLiteral', () => {
  it.each([[(k, v) => `${k}=${v}`, ' AND ', { qty, price, product }]])(
    'converts an object to a string',
    (literalFn, delimiter, obj) => {
      expect(
        convertObjectToLiteral(literalFn, delimiter, obj),
      ).toMatchSnapshot();
    },
  );
});

describe('convertObjectToLiteral filtering', () => {
  const literal = (k: string, v: any) => `${k}=${v}`;

  it('keeps 0 and false but drops other falsey values', () => {
    expect(
      convertObjectToLiteral(literal, '&', {
        zero: 0,
        no: false,
        empty: '',
        nil: null,
        undef: undefined,
        nan: NaN,
        yes: true,
      }),
    ).toBe('zero=0&no=false&yes=true');
  });

  it('stringifies values before passing them to literalFn', () => {
    const fn = jest.fn((k: string, v: any) => `${k}:${typeof v}`);
    expect(convertObjectToLiteral(fn, ',', { n: 1, b: true })).toBe(
      'n:string,b:string',
    );
  });

  it('passes undefined for values without toString', () => {
    const fn = jest.fn(() => 'x');
    convertObjectToLiteral(fn, ',', { bare: Object.create(null) });
    expect(fn).toHaveBeenCalledWith('bare', undefined);
  });

  it('returns an empty string for an empty object', () => {
    expect(convertObjectToLiteral(literal, ',', {})).toBe('');
  });
});
