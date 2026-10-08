import { generateUniqueCode } from './generate-unique-code';

describe('generateUniqueCode', () => {
  it('defaults to 24 URL-safe characters', () => {
    expect(generateUniqueCode()).toMatch(/^[A-Za-z0-9\-_~]{24}$/);
  });

  it('honours a custom length', () => {
    expect(generateUniqueCode(8)).toHaveLength(8);
    expect(generateUniqueCode(0)).toBe('');
  });

  it('produces different codes on successive calls', () => {
    expect(generateUniqueCode()).not.toBe(generateUniqueCode());
  });
});
