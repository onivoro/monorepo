import { useDate } from './use-date.function';

describe('useDate', () => {
  const mocked = '2020-05-17T10:20:30.000Z';

  it('mocks new Date() and Date.now() while fn runs, then restores Date', async () => {
    const OriginalDate = Date;
    let inside:
      | { now: number; constructed: string; explicit: string }
      | undefined;

    await useDate(mocked, async () => {
      inside = {
        now: Date.now(),
        constructed: new Date().toISOString(),
        explicit: new Date('2001-01-01T00:00:00.000Z').toISOString(),
      };
    });

    expect(inside).toEqual({
      now: new Date(mocked).getTime(),
      constructed: mocked,
      explicit: '2001-01-01T00:00:00.000Z',
    });
    expect(Date).toBe(OriginalDate);
    expect(new Date().toISOString()).not.toBe(mocked);
  });

  it('passes multi-argument constructor calls through', async () => {
    await useDate(mocked, async () => {
      expect(new Date(Date.UTC(1999, 11, 31)).toISOString()).toBe(
        '1999-12-31T00:00:00.000Z',
      );
      expect(new Date(0).getTime()).toBe(0);
    });
  });

  it('restores Date when fn rejects', async () => {
    const OriginalDate = Date;
    await expect(
      useDate(mocked, () => Promise.reject(new Error('x'))),
    ).rejects.toThrow('x');
    expect(Date).toBe(OriginalDate);
  });
});
