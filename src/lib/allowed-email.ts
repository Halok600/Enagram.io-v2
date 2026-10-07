/**
 * Single-owner guard. ALLOWED_EMAILS is a comma-separated list of the Google account emails
 * that may use this deployment. Unset or empty means unrestricted (the original behaviour,
 * which the app relied on while its Google OAuth app was in Testing mode). Set it BEFORE
 * publishing the OAuth app: every API route reads and writes the one shared database, so an
 * unrestricted published app would let any Google account read the owner's data through chat.
 */
export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined, rawAllowlist: string | undefined): boolean {
  const allowed = parseAllowedEmails(rawAllowlist);
  if (allowed.length === 0) return true;
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}
