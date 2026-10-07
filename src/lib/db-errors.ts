export type DbProblemKind = "paused" | "timeout" | "unreachable" | "not_configured" | "unknown";

/** Client-safe (no node imports): the status banner maps /api/health's `reason` through this. */
export const DB_PROBLEM_MESSAGES: Record<DbProblemKind, string> = {
  paused: "The database looks paused. Open Supabase, restore the project, wait a couple of minutes, then reload.",
  timeout: "The database did not answer in time. Wait a moment and reload.",
  unreachable: "Cannot reach the database. Check that DATABASE_URL is correct and the Supabase project is running.",
  not_configured: "DATABASE_URL is not set in this deployment.",
  unknown: "The database returned an unexpected error. Check the Vercel logs.",
};

/**
 * Order matters: Supabase's pooler answers a paused project with
 * "(ENOTFOUND) tenant/user postgres.<ref> not found", which also contains
 * ENOTFOUND, so "paused" must be checked before "unreachable".
 */
export function describeDbError(err: unknown): { kind: DbProblemKind; message: string } {
  const text = (err instanceof Error ? `${err.name} ${err.message}` : String(err)).toLowerCase();
  let kind: DbProblemKind = "unknown";
  if (text.includes("missing required env var database_url")) kind = "not_configured";
  else if (/tenant\/user .* not found|tenant or user not found/.test(text)) kind = "paused";
  else if (/did not respond|timeout|timed out/.test(text)) kind = "timeout";
  else if (/enotfound|econnrefused|econnreset|connection terminated/.test(text)) kind = "unreachable";
  return { kind, message: DB_PROBLEM_MESSAGES[kind] };
}
