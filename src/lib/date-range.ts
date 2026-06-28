/**
 * Parse a `YYYY-MM-DD` query-param value into a Date, snapping to the start or
 * end of that day. Returns undefined for empty/invalid input. Shared by the
 * dashboard list filters (orders, customers) so date-range handling is consistent.
 */
export function parseDateParam(value: string | undefined, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d;
}
