const ET = 'America/New_York';

/**
 * Returns today's date as YYYY-MM-DD in Eastern Time.
 * Avoids the UTC bug where toISOString() shows tomorrow after 7 PM ET.
 */
export function todayET(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: ET });
}

/**
 * Formats a Date (or ISO string) for display in Eastern Time.
 */
export function formatDateET(
  date: Date | string,
  options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { timeZone: ET, ...options });
}

/**
 * Formats a Date (or ISO string) with date + time in Eastern Time.
 */
export function formatDateTimeET(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString('en-US', { timeZone: ET });
}
