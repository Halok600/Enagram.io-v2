/**
 * Single-owner guard. ALLOWED_EMAILS is a comma-separated list of the Google account emails
 * that may use this deployment. Only an unset variable or the exact empty string means
 * unrestricted (the original behaviour, which the app relied on while its Google OAuth app was
 * in Testing mode). Set it BEFORE publishing the OAuth app: every API route reads and writes the
 * one shared database, so an unrestricted published app would let any Google account read the
 * owner's data through chat.
 * Any other value that holds no usable entry (e.g. "," or just spaces) is a misconfiguration
 * and fails closed: nobody can sign in, rather than silently becoming unrestricted.
 */
export function parseAllowedEmails(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);
}

export function isEmailAllowed(email: string | null | undefined, rawAllowlist: string | undefined): boolean {
  const allowed = parseAllowedEmails(rawAllowlist);
  if (allowed.length === 0) return rawAllowlist === undefined || rawAllowlist === "";
  if (!email) return false;
  return allowed.includes(email.trim().toLowerCase());
}

/** Sign-in decision: an explicitly unverified Google email is refused; undefined/true pass on to the allowlist. */
export function isSignInAllowed(
  email: string | null | undefined,
  emailVerified: boolean | undefined,
  rawAllowlist: string | undefined,
): boolean {
  if (emailVerified === false) return false;
  return isEmailAllowed(email, rawAllowlist);
}
