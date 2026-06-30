/**
 * Pure, dependency-free staff helpers (time maths for attendance & shifts).
 * Safe to import from client components.
 */

/** Whole minutes worked between clock-in and clock-out (never negative). */
export function workedMinutes(clockIn: Date | string, clockOut: Date | string): number {
  const inMs = new Date(clockIn).getTime();
  const outMs = new Date(clockOut).getTime();
  return Math.max(0, Math.floor((outMs - inMs) / 60000));
}

/** Duration of a shift in minutes (never negative). */
export function shiftDurationMins(startAt: Date | string, endAt: Date | string): number {
  return Math.max(0, Math.floor((new Date(endAt).getTime() - new Date(startAt).getTime()) / 60000));
}

/** Do two time ranges overlap? Touching edges (a.end === b.start) do not count. */
export function rangesOverlap(
  aStart: Date | string,
  aEnd: Date | string,
  bStart: Date | string,
  bEnd: Date | string
): boolean {
  const as = new Date(aStart).getTime();
  const ae = new Date(aEnd).getTime();
  const bs = new Date(bStart).getTime();
  const be = new Date(bEnd).getTime();
  return as < be && bs < ae;
}

/** Format a minute count as "Hh Mm" (e.g. 95 → "1h 35m"). */
export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
