import { fromBooleanString } from './from-boolean-string.function';

describe('fromBooleanString', () => {
  it('returns true only for the exact string "true"', () => {
    expect(fromBooleanString('true')).toBe(true);
  });

  it.each([undefined, '', 'false', 'TRUE', '1', 'yes'])(
    'returns false for %p',
    (input) => {
      expect(fromBooleanString(input)).toBe(false);
    },
  );
});
