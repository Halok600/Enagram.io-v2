export type DbProblemKind = "paused" | "timeout" | "unreachable" | "not_configured" | "unknown";

/** Client-safe (no node imports): the status banner maps /api/health's `reason` through this. */
export const DB_PROBLEM_MESSAGES: Record<DbProblemKind, string> = {
  paused: "The database looks paused. Open Supabase, restore the project, wait a couple of minutes, then reload.",
  timeout: "The database did not answer in time. Wait a moment and reload.",
  unreachable: "Cannot reach the database. Check that DATABASE_URL is correct and the Supabase project is running.",
  not_configured: "DATABASE_URL is not set in this deployment.",
  unknown: "The database returned an unexpected error. Check the Vercel logs.",
};

/** Shown when /api/health itself cannot be reached, which says nothing about DATABASE_URL. */
export const HEALTH_UNREACHABLE_MESSAGE =
  "Could not reach the app's health check, so the database status is unknown. Check your connection and reload.";

/** Maps /api/health's `reason` to text; an unknown or missing reason gets the generic message, never nothing. */
export function dbProblemMessage(reason: unknown): string {
  return typeof reason === "string" && Object.hasOwn(DB_PROBLEM_MESSAGES, reason)
    ? DB_PROBLEM_MESSAGES[reason as DbProblemKind]
    : DB_PROBLEM_MESSAGES.unknown;
}

/** Thrown by the store when DATABASE_URL is unset; describeDbError matches on it. */
export const MISSING_DATABASE_URL_MESSAGE = "Missing required env var DATABASE_URL";

/** `name message code` of the error plus its `cause` chain and AggregateError members (bounded). */
function errorText(err: unknown, depth = 0): string {
  if (!(err instanceof Error)) return String(err);
  const code = (err as { code?: unknown }).code;
  const parts = [err.name, err.message, typeof code === "string" ? code : ""];
  if (depth < 3) {
    if (err.cause !== undefined) parts.push(errorText(err.cause, depth + 1));
    if (err instanceof AggregateError) for (const inner of err.errors.slice(0, 5)) parts.push(errorText(inner, depth + 1));
  }
  return parts.join(" ");
}

/**
 * Order matters: Supabase's pooler answers a paused project with
 * "(ENOTFOUND) tenant/user postgres.<ref> not found", which also contains
 * ENOTFOUND, so "paused" must be checked before "unreachable".
 */
export function describeDbError(err: unknown): { kind: DbProblemKind; message: string } {
  const text = errorText(err).toLowerCase();
  let kind: DbProblemKind = "unknown";
  if (text.includes(MISSING_DATABASE_URL_MESSAGE.toLowerCase())) kind = "not_configured";
  else if (/tenant\/user .* not found|tenant or user not found/.test(text)) kind = "paused";
  else if (/did not respond|timeout|timed out|etimedout/.test(text)) kind = "timeout";
  else if (/enotfound|econnrefused|econnreset|ehostunreach|enetunreach|connection terminated|connection_(closed|destroyed|ended)/.test(
      text,
    )) kind = "unreachable";
  return { kind, message: DB_PROBLEM_MESSAGES[kind] };
}
