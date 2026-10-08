export type SyncPhase = "fetch" | "embed";

/**
 * Reads the POST body of /api/ingest/sync. A missing phase means "fetch" (the original default);
 * a phase that is present but not one of the two known values is rejected (null) instead of
 * silently running a full Google fetch.
 */
export function parseSyncRequest(raw: unknown): { phase: SyncPhase; auto: boolean } | null {
  const body = typeof raw === "object" && raw !== null ? (raw as { phase?: unknown; auto?: unknown }) : {};
  if (body.phase !== undefined && body.phase !== "fetch" && body.phase !== "embed") return null;
  return { phase: body.phase ?? "fetch", auto: body.auto === true };
}
