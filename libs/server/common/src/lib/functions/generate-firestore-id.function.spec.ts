import { generateFirestoreId } from './generate-firestore-id.function';

describe('generateFirestoreId', () => {
  it('defaults to 20 alphanumeric characters', () => {
    expect(generateFirestoreId()).toMatch(/^[A-Za-z0-9]{20}$/);
  });

  it('honours a custom length', () => {
    expect(generateFirestoreId(5)).toMatch(/^[A-Za-z0-9]{5}$/);
    expect(generateFirestoreId(0)).toBe('');
  });

  it('produces different ids on successive calls', () => {
    expect(generateFirestoreId()).not.toBe(generateFirestoreId());
  });
});
