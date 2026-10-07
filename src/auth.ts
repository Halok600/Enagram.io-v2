import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import type { JWT } from "next-auth/jwt";

const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const DRIVE_READONLY_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
// "View and edit events on all your calendars" — subsumes read access for
// events, so this replaces (not adds to) the earlier calendar.readonly scope.
// This app only ever touches calendarId "primary" events, never calendar
// list/settings, so calendar.events is the narrowest scope that covers
// create/update/delete/read — same "narrowest available" reasoning as
// GMAIL_COMPOSE_SCOPE below. See JOURNAL.md 2026-08-10.
const CALENDAR_EVENTS_SCOPE = "https://www.googleapis.com/auth/calendar.events";
// Narrowest scope that permits draft creation. Google doesn't offer a
// draft-only grant — gmail.compose technically also permits sending drafts
// via the API — so "never sends" is an app-code guarantee (createDraftReply
// in lib/google/gmail.ts only ever calls drafts.create, never drafts.send /
// messages.send), not an OAuth-level one. See JOURNAL.md 2026-08-09.
const GMAIL_COMPOSE_SCOPE = "https://www.googleapis.com/auth/gmail.compose";

const TOKEN_REFRESH_SKEW_MS = 60_000;

async function refreshAccessToken(token: JWT): Promise<JWT> {
  if (!token.refreshToken) {
    return { ...token, error: "MissingRefreshToken" as const };
  }

  try {
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken,
      }),
    });

    const refreshed = await response.json();
    if (!response.ok) throw refreshed;

    return {
      ...token,
      accessToken: refreshed.access_token,
      accessTokenExpiresAt: Date.now() + refreshed.expires_in * 1000,
      // Google only returns a new refresh_token occasionally; keep the old one otherwise.
      refreshToken: refreshed.refresh_token ?? token.refreshToken,
      error: undefined,
    };
  } catch (err) {
    console.error("Failed to refresh Google access token", err);
    return { ...token, error: "RefreshAccessTokenError" as const };
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      authorization: {
        params: {
          scope: `openid email profile ${GMAIL_READONLY_SCOPE} ${DRIVE_READONLY_SCOPE} ${CALENDAR_EVENTS_SCOPE} ${GMAIL_COMPOSE_SCOPE}`,
          access_type: "offline",
          prompt: "consent",
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.accessTokenExpiresAt = account.expires_at ? account.expires_at * 1000 : undefined;
        return token;
      }

      const expiresAt = token.accessTokenExpiresAt ?? 0;
      if (Date.now() < expiresAt - TOKEN_REFRESH_SKEW_MS) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken;
      session.accessTokenExpiresAt = token.accessTokenExpiresAt;
      session.error = token.error;
      return session;
    },
  },
});
