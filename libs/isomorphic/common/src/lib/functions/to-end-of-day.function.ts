/**
 * Converts a date string to a Date object representing the end of that day (23:59:59.999 UTC).
 *
 * If the input already includes a time component (contains 'T'), the original
 * parsed date is returned unchanged.
 *
 * @param dateStr - A date string in YYYY-MM-DD format or ISO 8601 datetime format
 * @returns A Date object set to the end of the day in UTC
 *
 * @example
 * // Date-only string - sets to end of day
 * toEndOfDay('2023-01-15') // Returns Date for 2023-01-15T23:59:59.999Z
 *
 * // Datetime string - returns as-is
 * toEndOfDay('2023-01-15T14:30:00Z') // Returns Date for 2023-01-15T14:30:00.000Z
 */
export function toEndOfDay(dateStr: string): Date {
  const date = new Date(dateStr);
  // If it's just a date (no time component), set to end of day
  if (!dateStr.includes('T')) {
    date.setUTCHours(23, 59, 59, 999);
  }
  return date;
}
