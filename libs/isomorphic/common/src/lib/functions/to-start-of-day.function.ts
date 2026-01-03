/**
 * Converts a date string to a Date object representing the start of that day (00:00:00.000 UTC).
 *
 * If the input already includes a time component (contains 'T'), the original
 * parsed date is returned unchanged.
 *
 * @param dateStr - A date string in YYYY-MM-DD format or ISO 8601 datetime format
 * @returns A Date object set to the start of the day in UTC
 *
 * @example
 * // Date-only string - sets to start of day
 * toStartOfDay('2023-01-15') // Returns Date for 2023-01-15T00:00:00.000Z
 *
 * // Datetime string - returns as-is
 * toStartOfDay('2023-01-15T14:30:00Z') // Returns Date for 2023-01-15T14:30:00.000Z
 */
export function toStartOfDay(dateStr: string): Date {
  const date = new Date(dateStr);
  // If it's just a date (no time component), set to start of day
  if (!dateStr.includes('T')) {
    date.setUTCHours(0, 0, 0, 0);
  }
  return date;
}
