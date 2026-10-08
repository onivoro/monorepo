import { generateNonce } from './generate-nonce';

describe(generateNonce.name, () => {
  it('defaults to 32 alphanumeric characters', () => {
    const nonce = generateNonce();
    expect(nonce).toHaveLength(32);
    expect(nonce).toMatch(/^[A-Za-z0-9]+$/);
  });

  it('honours a custom length', () => {
    expect(generateNonce(8)).toHaveLength(8);
    expect(generateNonce(0)).toBe('');
  });

  it('maps Math.random onto the alphabet', () => {
    const spy = jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(0)
      .mockReturnValueOnce(0.999999);
    try {
      expect(generateNonce(2)).toBe('A9');
    } finally {
      spy.mockRestore();
    }
  });
});
