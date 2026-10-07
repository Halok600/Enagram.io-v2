/**
 * Detects Google API 403s specifically, so calendar-write failures can
 * surface something actionable instead of a generic "failed" message.
 * The one common, previously-invisible case found in the 2026-08-13
 * code-review pass: a session that predates the calendar.events scope
 * upgrade (2026-08-10) still carries a refresh token scoped read-only —
 * Google's refresh-token grant reissues at the ORIGINALLY consented
 * scope, it never silently upgrades — so every calendar write attempt
 * 403s until the user re-authenticates, with nothing telling them that's
 * the fix.
 */
export function friendlyGoogleErrorMessage(err: unknown): string | null {
  const code =
    (err as { code?: number })?.code ?? (err as { response?: { status?: number } })?.response?.status;
  if (code === 403) {
    return "Google denied this calendar request (insufficient permission). If you connected your account before calendar write access was added, disconnect and reconnect to grant it.";
  }
  return null;
}
