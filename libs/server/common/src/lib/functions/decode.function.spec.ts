import { decode } from './decode.function';

describe('decode', () => {
  it('returns undefined without a token', () => {
    expect(decode()).toBeUndefined();
    expect(decode('')).toBeUndefined();
  });

  it('decodes the payload segment of a JWT-shaped token', () => {
    const payload = Buffer.from(
      JSON.stringify({ sub: '123', admin: true }),
    ).toString('base64');
    expect(decode(`header.${payload}.signature`)).toEqual({
      sub: '123',
      admin: true,
    });
  });

  it('throws when the payload is not JSON', () => {
    const payload = Buffer.from('nope').toString('base64');
    expect(() => decode(`h.${payload}.s`)).toThrow(SyntaxError);
  });
});
