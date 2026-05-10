import { removeFalseyKeys } from './remove-falsey-keys.function';

describe(removeFalseyKeys.name, () => {
  it('drops keys whose value is undefined', () => {
    expect(removeFalseyKeys({ a: 1, b: undefined })).toEqual({ a: 1 });
  });

  it('keeps null despite the name (only undefined is filtered)', () => {
    expect(removeFalseyKeys({ a: null as any })).toEqual({ a: null });
  });

  it('keeps empty string, 0, and false (only undefined is filtered)', () => {
    expect(removeFalseyKeys({ a: '', b: 0, c: false })).toEqual({ a: '', b: 0, c: false });
  });

  it('is a no-op on an empty object', () => {
    expect(removeFalseyKeys({})).toEqual({});
  });
});
