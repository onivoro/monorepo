import { convertObjectToLiteral } from './convert-object-to-literal.function';

const qty = 337;
const price = 100;
const product = 'flux-capacitor';

describe('convertObjectToLiteral', () => {
  it.each([[(k, v) => `${k}=${v}`, ' AND ', { qty, price, product }]])(
    'converts an object to a string',
    (literalFn, delimiter, obj) => {
      expect(
        convertObjectToLiteral(literalFn, delimiter, obj)
      ).toMatchSnapshot();
    }
  );
});
