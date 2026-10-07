import { NextResponse } from "next/server";
import type { Session } from "next-auth";
import { auth } from "@/auth";

export type AuthedSession = Session & { accessToken: string };

/**
 * Shared auth-check for API routes — every route handler in this app
 * needs the exact same "signed in, with a live access token, no refresh
 * error" guard before doing anything else. Was duplicated verbatim
 * across 8 route files (found in the 2026-08-13 code-review pass);
 * factored out here so the contract only needs to change in one place.
 * `session.accessToken` is narrowed to a required `string` in the
 * returned type, not just checked at runtime — callers don't need their
 * own `!session.accessToken` guard after this.
 */
export async function requireSession(): Promise<
  { session: AuthedSession; error: null } | { session: null; error: NextResponse }
> {
  const session = await auth();
  if (!session?.accessToken) {
    return { session: null, error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (session.error) {
    return { session: null, error: NextResponse.json({ error: session.error }, { status: 401 }) };
  }
  return { session: session as AuthedSession, error: null };
}
