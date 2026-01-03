import { toEndOfDay } from './to-end-of-day.function';
import { toStartOfDay } from './to-start-of-day.function';

describe('toEndOfDay', () => {
  describe('with date-only strings (YYYY-MM-DD)', () => {
    it('sets time to 23:59:59.999 UTC', () => {
      const result = toEndOfDay('2023-01-15');

      expect(result.getUTCHours()).toBe(23);
      expect(result.getUTCMinutes()).toBe(59);
      expect(result.getUTCSeconds()).toBe(59);
      expect(result.getUTCMilliseconds()).toBe(999);
    });

    it('preserves the date portion', () => {
      const result = toEndOfDay('2023-06-20');

      expect(result.getUTCFullYear()).toBe(2023);
      expect(result.getUTCMonth()).toBe(5); // June is month 5 (0-indexed)
      expect(result.getUTCDate()).toBe(20);
    });

    it('handles first day of year', () => {
      const result = toEndOfDay('2024-01-01');

      expect(result.toISOString()).toBe('2024-01-01T23:59:59.999Z');
    });

    it('handles last day of year', () => {
      const result = toEndOfDay('2023-12-31');

      expect(result.toISOString()).toBe('2023-12-31T23:59:59.999Z');
    });

    it('handles leap year date', () => {
      const result = toEndOfDay('2024-02-29');

      expect(result.toISOString()).toBe('2024-02-29T23:59:59.999Z');
    });

    it('handles end of month dates', () => {
      const result = toEndOfDay('2023-04-30');

      expect(result.toISOString()).toBe('2023-04-30T23:59:59.999Z');
    });
  });

  describe('with datetime strings (ISO 8601)', () => {
    it('preserves the original time when T is present', () => {
      const result = toEndOfDay('2023-01-15T14:30:45.123Z');

      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(45);
      expect(result.getUTCMilliseconds()).toBe(123);
    });

    it('preserves midnight times', () => {
      const result = toEndOfDay('2023-01-15T00:00:00.000Z');

      expect(result.toISOString()).toBe('2023-01-15T00:00:00.000Z');
    });

    it('preserves end of day times', () => {
      const result = toEndOfDay('2023-01-15T23:59:59.999Z');

      expect(result.toISOString()).toBe('2023-01-15T23:59:59.999Z');
    });

    it('handles timezone offsets', () => {
      const result = toEndOfDay('2023-01-15T14:30:00-07:00');

      // -07:00 offset means 14:30 local = 21:30 UTC
      expect(result.getUTCHours()).toBe(21);
      expect(result.getUTCMinutes()).toBe(30);
    });
  });

  describe('edge cases', () => {
    it('returns a Date object', () => {
      const result = toEndOfDay('2023-01-15');

      expect(result).toBeInstanceOf(Date);
    });

    it('returns a new Date instance each call', () => {
      const result1 = toEndOfDay('2023-01-15');
      const result2 = toEndOfDay('2023-01-15');

      expect(result1).not.toBe(result2);
      expect(result1.getTime()).toBe(result2.getTime());
    });
  });
});

describe('toStartOfDay and toEndOfDay together', () => {
  it('creates a valid date range for the same day', () => {
    const dateStr = '2023-06-15';
    const start = toStartOfDay(dateStr);
    const end = toEndOfDay(dateStr);

    expect(start.getTime()).toBeLessThan(end.getTime());
  });

  it('range spans exactly 23:59:59.999 (one day minus 1ms)', () => {
    const dateStr = '2023-06-15';
    const start = toStartOfDay(dateStr);
    const end = toEndOfDay(dateStr);

    const diffMs = end.getTime() - start.getTime();
    const expectedMs = 23 * 60 * 60 * 1000 + 59 * 60 * 1000 + 59 * 1000 + 999;

    expect(diffMs).toBe(expectedMs);
  });

  it('can be used for inclusive date range queries', () => {
    const startDate = '2023-06-01';
    const endDate = '2023-06-30';

    const rangeStart = toStartOfDay(startDate);
    const rangeEnd = toEndOfDay(endDate);

    // A timestamp at any point during June 15th should fall within the range
    const midMonthTimestamp = new Date('2023-06-15T12:30:00Z');
    expect(midMonthTimestamp.getTime()).toBeGreaterThanOrEqual(
      rangeStart.getTime()
    );
    expect(midMonthTimestamp.getTime()).toBeLessThanOrEqual(rangeEnd.getTime());

    // First moment of June should be included
    const firstMoment = new Date('2023-06-01T00:00:00.000Z');
    expect(firstMoment.getTime()).toBeGreaterThanOrEqual(rangeStart.getTime());
    expect(firstMoment.getTime()).toBeLessThanOrEqual(rangeEnd.getTime());

    // Last moment of June should be included
    const lastMoment = new Date('2023-06-30T23:59:59.999Z');
    expect(lastMoment.getTime()).toBeGreaterThanOrEqual(rangeStart.getTime());
    expect(lastMoment.getTime()).toBeLessThanOrEqual(rangeEnd.getTime());

    // First moment of July should NOT be included
    const julyFirst = new Date('2023-07-01T00:00:00.000Z');
    expect(julyFirst.getTime()).toBeGreaterThan(rangeEnd.getTime());
  });

  it('handles single-day range correctly', () => {
    const dateStr = '2023-06-15';
    const rangeStart = toStartOfDay(dateStr);
    const rangeEnd = toEndOfDay(dateStr);

    // Activity at start of day should be included
    const morningActivity = new Date('2023-06-15T06:00:00Z');
    expect(morningActivity.getTime()).toBeGreaterThanOrEqual(
      rangeStart.getTime()
    );
    expect(morningActivity.getTime()).toBeLessThanOrEqual(rangeEnd.getTime());

    // Activity at end of day should be included
    const eveningActivity = new Date('2023-06-15T22:00:00Z');
    expect(eveningActivity.getTime()).toBeGreaterThanOrEqual(
      rangeStart.getTime()
    );
    expect(eveningActivity.getTime()).toBeLessThanOrEqual(rangeEnd.getTime());

    // Activity from previous day should NOT be included
    const yesterdayActivity = new Date('2023-06-14T23:59:59.999Z');
    expect(yesterdayActivity.getTime()).toBeLessThan(rangeStart.getTime());

    // Activity from next day should NOT be included
    const tomorrowActivity = new Date('2023-06-16T00:00:00.000Z');
    expect(tomorrowActivity.getTime()).toBeGreaterThan(rangeEnd.getTime());
  });
});
