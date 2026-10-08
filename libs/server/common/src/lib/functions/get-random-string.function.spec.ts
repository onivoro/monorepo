import { getRandomString } from './get-random-string.function';

describe('getRandomString', () => {
  it('returns a dashless UUID by default', () => {
    expect(getRandomString()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('wraps the UUID with prefix and postfix', () => {
    expect(getRandomString('pre-', '.txt')).toMatch(/^pre-[0-9a-f]{32}\.txt$/);
  });

  it('produces different values on successive calls', () => {
    expect(getRandomString()).not.toBe(getRandomString());
  });
});
