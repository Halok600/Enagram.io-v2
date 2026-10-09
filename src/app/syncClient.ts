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
  rateLimited?: boolean;
};

export type FullSyncResult = {
  counts: SyncProgress["counts"];
  documents: number;
  changed: number;
  embedded: number;
  remaining: number;
  skipped: boolean;
  stalled: boolean;
  /** Stopped because the embedding quota was hit on several rounds in a row. */
  rateLimited: boolean;
};

/**
 * Pauses between embed rounds so Gemini's free tier (about 30k tokens per minute) can recover;
 * see the arithmetic in src/lib/sync/engine.ts. Each round sends at most ~20k tokens.
 */
export const EMBED_ROUND_WAIT_MS = 40_000;
/** After a quota error a full minute window has to pass. */
export const RATE_LIMITED_WAIT_MS = 60_000;
/** This many rate-limited rounds in a row and the run gives up instead of hammering the API. */
export const MAX_RATE_LIMITED_ROUNDS = 3;

export type SyncWait = { seconds: number; remaining: number };

export function waitingMessage(wait: SyncWait): string {
  return `Waiting ${wait.seconds}s so Gemini's free-tier limit can recover (${wait.remaining} document(s) left)...`;
}

/** What to tell the user when a run ended with documents not indexed; null when nothing is left. */
export function syncStopMessage(result: FullSyncResult): string | null {
  if (result.rateLimited) {
    return `Gemini's embedding limit was reached (free tier). ${result.remaining} document(s) are not indexed for search by meaning yet; keyword search already works. Try again in a few minutes, or turn on billing for the Gemini API key to lift the limit.`;
  }
  if (result.stalled) {
    return "Search by meaning is still catching up (some documents are not indexed yet). Keyword search already works. Press Sync again in a minute.";
  }
  return null;
}

/**
 * One fetch request, then embed requests while anything is left. The server does
 * about 35s of embedding per request (Vercel's limit is 60s), so a first full
 * sync takes a few rounds. Between rounds it waits (40s, or 60s after a quota error) so the
 * Gemini free tier can recover, and gives up after 3 quota errors in a row (`rateLimited`).
 * Stops early if a round embeds nothing for any other reason rather than spinning. `stalled`
 * means indexing is incomplete when it stops: no progress, quota stop, or maxRounds ran out
 * with work still left. `auto` (the unattended run on page load) does one embed round and
 * never waits; the user presses Sync now to continue.
 */
export async function runFullSync(
  options: {
    auto?: boolean;
    fetchFn?: typeof fetch;
    onProgress?: (progress: SyncProgress) => void;
    maxRounds?: number;
    /** Injectable so tests do not really wait. */
    sleep?: (ms: number) => Promise<void>;
    /** Called with the pause before it starts, and with null when it ends. */
    onWait?: (wait: SyncWait | null) => void;
  } = {},
): Promise<FullSyncResult> {
  const { auto = false, onProgress, onWait, maxRounds = 30 } = options;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const fetchFn: typeof fetch = options.fetchFn ?? ((input, init) => fetch(input, init));

  async function call(body: object): Promise<SyncProgress> {
    const res = await fetchFn("/api/ingest/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Vercel's gateway answers a timed-out function with an HTML page, not JSON.
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error ?? `The server stopped answering (${res.status}). Try Sync again.`);
    }
    if (!data) throw new Error("The server sent an unexpected response. Try Sync again.");
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
    rateLimited: false,
  };

  let rateLimitedStreak = 0;
  for (let round = 0; round < maxRounds && result.remaining > 0; round++) {
    progress = await call({ phase: "embed" });
    onProgress?.(progress);
    result.embedded += progress.embedded;
    result.remaining = progress.remaining;
    result.documents = progress.documents;

    rateLimitedStreak = progress.rateLimited ? rateLimitedStreak + 1 : 0;
    if (rateLimitedStreak >= MAX_RATE_LIMITED_ROUNDS) {
      result.rateLimited = true;
      break;
    }
    // A quota round may embed nothing and still be worth retrying after the wait; any other empty round is a stall.
    if (progress.embedded === 0 && !progress.rateLimited) break;
    if (auto || result.remaining === 0 || round + 1 >= maxRounds) break;

    const waitMs = progress.rateLimited ? RATE_LIMITED_WAIT_MS : EMBED_ROUND_WAIT_MS;
    onWait?.({ seconds: waitMs / 1000, remaining: result.remaining });
    try {
      await sleep(waitMs);
    } finally {
      onWait?.(null);
    }
  }
  result.stalled = result.remaining > 0;
  return result;
}
