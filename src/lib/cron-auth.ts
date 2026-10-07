import { timingSafeEqual } from "node:crypto";

/**
 * Vercel Cron calls a route with `Authorization: Bearer $CRON_SECRET` when the
 * CRON_SECRET env var is set. Fails closed: with no secret configured, nobody
 * is authorized — otherwise the keepalive route would be open to the internet.
 */
export function isAuthorizedCron(authorization: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authorization ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
