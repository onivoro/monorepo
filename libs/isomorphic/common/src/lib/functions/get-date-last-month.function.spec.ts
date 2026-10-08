import { getDateLastMonth } from './get-date-last-month.function';

describe('getDateLastMonth', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    ['2024-03-15T12:00:00.000Z', '2024-02-28T12:00:00.000Z'],
    ['2024-03-01T00:00:00.000Z', '2024-02-28T00:00:00.000Z'],
    ['2024-01-31T23:59:59.000Z', '2023-12-30T23:59:59.000Z'],
  ])(
    'when now is %s, returns %s (a day in the previous UTC month)',
    (now, expected) => {
      jest.useFakeTimers({ now: new Date(now) });

      const result = getDateLastMonth();

      expect(result.toISOString()).toBe(expected);
      expect(result.getUTCMonth()).toBe(
        (new Date(now).getUTCMonth() + 11) % 12,
      );
    },
  );
});
