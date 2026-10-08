import { decode } from './decode.function';
import { encode } from './encode.function';

describe('encode', () => {
  it('worx for hacky situations', () => {
    const encoded = encode({ key: 'value' });
    expect(decode(encoded).key).toMatchSnapshot();
  });

  it('encodes an empty object by default, wrapped as a JWT-shaped payload', () => {
    const encoded = encode();
    expect(encoded).toMatch(/^\.[A-Za-z0-9+/=]+\.$/);
    expect(decode(encoded)).toEqual({});
  });
});
