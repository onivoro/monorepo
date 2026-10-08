import { fromCalendarDate } from './from-calendar-date.function';
import { toCalendarDate } from './to-calendar-date.function';

describe('toCalendarDate', () => {
  it.each([undefined, null, '', 'garbage'])(
    'returns undefined for %p',
    (input) => {
      expect(toCalendarDate(input)).toBeUndefined();
    },
  );

  it('returns the local calendar date of a Date as YYYY-MM-DD', () => {
    expect(toCalendarDate(new Date(2023, 11, 23, 15, 30))).toBe('2023-12-23');
    expect(toCalendarDate(new Date(2024, 1, 29, 0, 0))).toBe('2024-02-29');
    expect(toCalendarDate(new Date(2024, 0, 1, 23, 59))).toBe('2024-01-01');
  });

  it('round-trips with fromCalendarDate', () => {
    expect(toCalendarDate(fromCalendarDate('2023-12-23'))).toBe('2023-12-23');
  });
});
