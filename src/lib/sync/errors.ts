import { describeDbError } from "../db-errors.ts";

/** Marks an error that came from the Google fetch, so it is never mistaken for a database problem. */
export class GoogleFetchError extends Error {
  constructor(cause: unknown) {
    super(`Google request failed: ${cause instanceof Error ? cause.message : String(cause)}`, { cause });
    this.name = "GoogleFetchError";
  }
}

/** The user-facing message for a failed sync request. */
export function syncErrorMessage(err: unknown): string {
  if (err instanceof GoogleFetchError) return err.message;
  const problem = describeDbError(err);
  if (problem.kind !== "unknown") return problem.message;
  return err instanceof Error ? err.message : "Ingestion sync failed";
}
