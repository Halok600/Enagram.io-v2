import type { BrainDocument } from "../brain/types.ts";
import type { Db } from "../store/db.ts";
import {
  countDocuments,
  countPending,
  deleteCalendarExcept,
  pendingEmbeddings,
  setEmbeddings,
  upsertDocuments,
} from "../store/documents.ts";
import { rebuildLinks } from "../store/links.ts";
import { setMeta } from "../store/meta.ts";
import { isUsableVector } from "../store/vector.ts";
import { toStoredDocument } from "./to-stored.ts";
import { withTimeout } from "./with-timeout.ts";

export type FetchedDocuments = {
  gmail: BrainDocument[];
  drive: BrainDocument[];
  calendar: BrainDocument[];
  /** The calendar list hit its page cap, so it is NOT a complete window: nothing may be deleted from it. */
  calendarTruncated?: boolean;
};

export type SyncDeps = {
  db: Db;
  fetchDocuments: () => Promise<FetchedDocuments>;
  embedDocuments: (texts: string[]) => Promise<number[][]>;
  ownEmail: string;
  /** Calendar-only re-ingests pass false so they don't postpone the next full auto-sync. */
  touchLastSynced?: boolean;
  now?: () => number;
};

export type SyncProgress = {
  phase: "fetch" | "embed";
  skipped?: boolean;
  counts: { gmail: number; drive: number; calendar: number } | null;
  documents: number;
  changed: number;
  embedded: number;
  remaining: number;
};

/**
 * Counted from the start of the request (cold start and the fetch phase included), so a
 * call begun just inside it (EMBED_CALL_TIMEOUT_MS) still ends before Vercel's 60s limit.
 */
export const EMBED_BUDGET_MS = 35_000;
const EMBED_BATCH_SIZE = 20;
/** One embedding call; with the 35s budget a call started just inside it still ends before ~50s. */
export const EMBED_CALL_TIMEOUT_MS = 15_000;

/**
 * Phase 1: pull from Google, store text, and relink. Cheap and idempotent:
 * unchanged documents are not rewritten and keep their embeddings. Links are
 * rebuilt on every fetch so overlapping or failed rebuilds self-heal.
 */
export async function runFetchPhase(deps: SyncDeps): Promise<SyncProgress> {
  const fetched = await deps.fetchDocuments();
  const all = [...fetched.gmail, ...fetched.drive, ...fetched.calendar].map(toStoredDocument);

  const { changed } = await upsertDocuments(deps.db, all);
  if (fetched.calendarTruncated) {
    // A truncated list is not a complete window: a missing event may just be on a page we never read.
    console.warn("Calendar list was truncated; skipping deletion of calendar rows for this sync");
  } else {
    // The calendar fetch is a complete window, so anything missing from it was deleted in Google.
    await deleteCalendarExcept(
      deps.db,
      fetched.calendar.map((d) => d.id),
    );
  }
  // Rebuilt on every fetch, not only when something changed: overlapping syncs can commit an
  // older link set, and a rebuild that fails after the upsert would otherwise never be retried
  // (the next fetch sees changed == 0). One select plus one transaction, so unconditional is cheap.
  await rebuildLinks(deps.db, deps.ownEmail);
  if (deps.touchLastSynced !== false) {
    await setMeta(deps.db, "last_synced_at", String((deps.now ?? Date.now)()));
  }

  return {
    phase: "fetch",
    counts: { gmail: fetched.gmail.length, drive: fetched.drive.length, calendar: fetched.calendar.length },
    documents: await countDocuments(deps.db),
    changed,
    embedded: 0,
    remaining: await countPending(deps.db),
  };
}

/**
 * Phase 2: embed pending documents until the time budget is spent. Failures
 * (e.g. free-tier rate limits, a slow call, a failed write) are logged, stop the
 * phase with the progress made so far, and leave rows pending; keyword search
 * works on them meanwhile, so a failed embedding never hides data. A malformed
 * vector skips just that document.
 */
export async function runEmbedPhase(
  deps: SyncDeps,
  budgetMs = EMBED_BUDGET_MS,
  batchSize = EMBED_BATCH_SIZE,
  callTimeoutMs = EMBED_CALL_TIMEOUT_MS,
  /** When the request began; the budget counts from here so cold start and the fetch phase are not free. */
  startedAt?: number,
): Promise<SyncProgress> {
  const now = deps.now ?? Date.now;
  const start = startedAt ?? now();
  let embedded = 0;
  const skipped = new Set<string>(); // got a malformed vector; left pending, not retried this call

  while (now() - start < budgetMs) {
    const batch = await pendingEmbeddings(deps.db, batchSize, [...skipped]);
    if (batch.length === 0) break;

    let vectors: number[][];
    try {
      vectors = await withTimeout(
        Promise.resolve().then(() => deps.embedDocuments(batch.map((b) => b.text))),
        callTimeoutMs,
        "Embedding call",
      );
    } catch (err) {
      console.error("Embedding batch failed; documents stay pending", err);
      break;
    }
    if (vectors.length !== batch.length) {
      console.error(`Embedder returned ${vectors.length} vectors for ${batch.length} documents; stopping`);
      break;
    }

    const items = [];
    for (const [i, b] of batch.entries()) {
      if (isUsableVector(vectors[i])) {
        items.push({ id: b.id, hash: b.hash, embedding: vectors[i] });
      } else {
        console.error(`Embedder returned an unusable vector for ${b.id}; skipping it`);
        skipped.add(b.id);
      }
    }

    try {
      embedded += await setEmbeddings(deps.db, items);
    } catch (err) {
      console.error("Storing embeddings failed; documents stay pending", err);
      break;
    }
  }

  return {
    phase: "embed",
    counts: null,
    documents: await countDocuments(deps.db),
    changed: 0,
    embedded,
    remaining: await countPending(deps.db),
  };
}
