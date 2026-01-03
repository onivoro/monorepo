import { toStartOfDay } from './to-start-of-day.function';

describe('toStartOfDay', () => {
  describe('with date-only strings (YYYY-MM-DD)', () => {
    it('sets time to 00:00:00.000 UTC', () => {
      const result = toStartOfDay('2023-01-15');

      expect(result.getUTCHours()).toBe(0);
      expect(result.getUTCMinutes()).toBe(0);
      expect(result.getUTCSeconds()).toBe(0);
      expect(result.getUTCMilliseconds()).toBe(0);
    });

    it('preserves the date portion', () => {
      const result = toStartOfDay('2023-06-20');

      expect(result.getUTCFullYear()).toBe(2023);
      expect(result.getUTCMonth()).toBe(5); // June is month 5 (0-indexed)
      expect(result.getUTCDate()).toBe(20);
    });

    it('handles first day of year', () => {
      const result = toStartOfDay('2024-01-01');

      expect(result.toISOString()).toBe('2024-01-01T00:00:00.000Z');
    });

    it('handles last day of year', () => {
      const result = toStartOfDay('2023-12-31');

      expect(result.toISOString()).toBe('2023-12-31T00:00:00.000Z');
    });

    it('handles leap year date', () => {
      const result = toStartOfDay('2024-02-29');

      expect(result.toISOString()).toBe('2024-02-29T00:00:00.000Z');
    });

    it('handles end of month dates', () => {
      const result = toStartOfDay('2023-04-30');

      expect(result.toISOString()).toBe('2023-04-30T00:00:00.000Z');
    });
  });

  describe('with datetime strings (ISO 8601)', () => {
    it('preserves the original time when T is present', () => {
      const result = toStartOfDay('2023-01-15T14:30:45.123Z');

      expect(result.getUTCHours()).toBe(14);
      expect(result.getUTCMinutes()).toBe(30);
      expect(result.getUTCSeconds()).toBe(45);
      expect(result.getUTCMilliseconds()).toBe(123);
    });

    it('preserves midnight times', () => {
      const result = toStartOfDay('2023-01-15T00:00:00.000Z');

      expect(result.toISOString()).toBe('2023-01-15T00:00:00.000Z');
    });

    it('preserves end of day times', () => {
      const result = toStartOfDay('2023-01-15T23:59:59.999Z');

      expect(result.toISOString()).toBe('2023-01-15T23:59:59.999Z');
    });

    it('handles timezone offsets', () => {
      const result = toStartOfDay('2023-01-15T14:30:00-07:00');

      // -07:00 offset means 14:30 local = 21:30 UTC
      expect(result.getUTCHours()).toBe(21);
      expect(result.getUTCMinutes()).toBe(30);
    });

    it('handles positive timezone offsets', () => {
      const result = toStartOfDay('2023-01-15T03:30:00+05:30');

      // +05:30 offset means 03:30 local = 22:00 UTC on previous day
      expect(result.getUTCHours()).toBe(22);
      expect(result.getUTCDate()).toBe(14); // Rolls back to previous day
    });
  });

  describe('edge cases', () => {
    it('returns a Date object', () => {
      const result = toStartOfDay('2023-01-15');

      expect(result).toBeInstanceOf(Date);
    });

    it('returns a new Date instance each call', () => {
      const result1 = toStartOfDay('2023-01-15');
      const result2 = toStartOfDay('2023-01-15');

      expect(result1).not.toBe(result2);
      expect(result1.getTime()).toBe(result2.getTime());
    });
  });
});
