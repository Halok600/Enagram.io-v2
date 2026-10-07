// Mirrors SyncProgress in src/lib/sync/engine.ts. Duplicated on purpose: that
// module pulls in server-only code (node:crypto, the database layer) that must
// not be bundled into the browser.
export type SyncProgress = {
  phase: "fetch" | "embed";
  skipped?: boolean;
  counts: { gmail: number; drive: number; calendar: number } | null;
  documents: number;
  changed: number;
  embedded: number;
  remaining: number;
};

export type FullSyncResult = {
  counts: SyncProgress["counts"];
  documents: number;
  changed: number;
  embedded: number;
  remaining: number;
  skipped: boolean;
  stalled: boolean;
};

/**
 * One fetch request, then embed requests while anything is left. The server does
 * about 40s of embedding per request (Vercel's limit is 60s), so a first full
 * sync takes a few rounds. Stops early if a round embeds nothing (e.g. the
 * embedding service is rate-limited) rather than spinning.
 */
export async function runFullSync(
  options: {
    auto?: boolean;
    fetchFn?: typeof fetch;
    onProgress?: (progress: SyncProgress) => void;
    maxRounds?: number;
  } = {},
): Promise<FullSyncResult> {
  const { auto = false, onProgress, maxRounds = 30 } = options;
  const fetchFn: typeof fetch = options.fetchFn ?? ((input, init) => fetch(input, init));

  async function call(body: object): Promise<SyncProgress> {
    const res = await fetchFn("/api/ingest/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error ?? "Sync failed");
    return data as SyncProgress;
  }

  let progress = await call({ phase: "fetch", auto });
  onProgress?.(progress);

  const result: FullSyncResult = {
    counts: progress.counts,
    documents: progress.documents,
    changed: progress.changed,
    embedded: progress.embedded,
    remaining: progress.remaining,
    skipped: Boolean(progress.skipped),
    stalled: false,
  };

  for (let round = 0; round < maxRounds && result.remaining > 0; round++) {
    progress = await call({ phase: "embed" });
    onProgress?.(progress);
    result.embedded += progress.embedded;
    result.remaining = progress.remaining;
    result.documents = progress.documents;
    if (progress.embedded === 0) {
      result.stalled = result.remaining > 0;
      break;
    }
  }
  return result;
}
