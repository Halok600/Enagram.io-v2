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
import { toStoredDocument } from "./to-stored.ts";

export type FetchedDocuments = { gmail: BrainDocument[]; drive: BrainDocument[]; calendar: BrainDocument[] };

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

/** Leaves ~20s of Vercel's 60s limit for the request itself and the response. */
export const EMBED_BUDGET_MS = 40_000;
const EMBED_BATCH_SIZE = 20;

/**
 * Phase 1: pull from Google, store text, and relink. Cheap and idempotent:
 * unchanged documents are not rewritten and keep their embeddings. Links are
 * rebuilt on every fetch so overlapping or failed rebuilds self-heal.
 */
export async function runFetchPhase(deps: SyncDeps): Promise<SyncProgress> {
  const fetched = await deps.fetchDocuments();
  const all = [...fetched.gmail, ...fetched.drive, ...fetched.calendar].map(toStoredDocument);

  const { changed } = await upsertDocuments(deps.db, all);
  // The calendar fetch is a complete window, so anything missing from it was deleted in Google.
  await deleteCalendarExcept(
    deps.db,
    fetched.calendar.map((d) => d.id),
  );
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
 * (e.g. free-tier rate limits) are logged and leave rows pending; keyword
 * search works on them meanwhile, so a failed embedding never hides data.
 */
export async function runEmbedPhase(
  deps: SyncDeps,
  budgetMs = EMBED_BUDGET_MS,
  batchSize = EMBED_BATCH_SIZE,
): Promise<SyncProgress> {
  const now = deps.now ?? Date.now;
  const start = now();
  let embedded = 0;

  while (now() - start < budgetMs) {
    const batch = await pendingEmbeddings(deps.db, batchSize);
    if (batch.length === 0) break;

    let vectors: number[][];
    try {
      vectors = await deps.embedDocuments(batch.map((b) => b.text));
    } catch (err) {
      console.error("Embedding batch failed; documents stay pending", err);
      break;
    }
    if (vectors.length !== batch.length) {
      console.error(`Embedder returned ${vectors.length} vectors for ${batch.length} documents; stopping`);
      break;
    }

    await setEmbeddings(
      deps.db,
      batch.map((b, i) => ({ id: b.id, hash: b.hash, embedding: vectors[i] })),
    );
    embedded += batch.length;
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
