const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function isDateOnly(value: string): boolean {
  return DATE_ONLY_RE.test(value);
}

/**
 * Google Calendar all-day events serialize start/end as bare "YYYY-MM-DD"
 * strings with no timezone. `new Date("YYYY-MM-DD")` parses that per the
 * ECMA-262 spec as UTC midnight, so reading it back with local getters
 * (getFullYear/getMonth/getDate) silently shifts the date by the viewer's
 * UTC offset — e.g. a UTC-7 viewer would see an Aug 20 all-day event as
 * Aug 19. Detect the date-only form and build the Date from local Y/M/D
 * components instead, so local getters always round-trip the intended
 * calendar date. Timed events already carry an explicit offset, so those
 * parse correctly through the normal Date constructor.
 */
export function parseEventDate(value: string): Date {
  if (isDateOnly(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(value);
}

/** Shifts a "YYYY-MM-DD" date-only string by `days` using UTC-anchored
 * arithmetic — pure calendar-date math with no local-timezone involvement,
 * so it's correct regardless of the caller's offset. */
export function shiftDateOnly(value: string, days: number): string {
  const [y, m, d] = value.split("-").map(Number);
  const shifted = new Date(Date.UTC(y, m - 1, d) + days * DAY_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}
