import { getDateRangeForMonth } from './get-date-range-for-month.function';

describe('getDateRangeForMonth', () => {
  it.each([
    [2024, 1, '2024-01-01T00:00:00.000Z', '2024-02-01T00:00:00.000Z'],
    [2024, 2, '2024-02-01T00:00:00.000Z', '2024-03-01T00:00:00.000Z'],
    [2023, 2, '2023-02-01T00:00:00.000Z', '2023-03-01T00:00:00.000Z'],
    [2023, 12, '2023-12-01T00:00:00.000Z', '2024-01-01T00:00:00.000Z'],
  ])('(%p, %p) => [%s, %s)', (year, month, start, end) => {
    const { startDate, endDate } = getDateRangeForMonth(year, month);

    expect(startDate.toISOString()).toBe(start);
    expect(endDate.toISOString()).toBe(end);
  });
});
