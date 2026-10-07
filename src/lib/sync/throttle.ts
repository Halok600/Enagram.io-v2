export const AUTO_SYNC_MIN_INTERVAL_MS = 10 * 60_000;

/**
 * Auto-sync used to fire on every page load, and a burst of reloads exhausted
 * Gmail's per-user quota (2026-10-07). Skip it if a sync finished recently.
 */
export function shouldAutoSync(
  lastSyncedAtMs: number | null,
  nowMs: number,
  minIntervalMs = AUTO_SYNC_MIN_INTERVAL_MS,
): boolean {
  if (lastSyncedAtMs === null || !Number.isFinite(lastSyncedAtMs)) return true;
  return nowMs - lastSyncedAtMs >= minIntervalMs;
}
