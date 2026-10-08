import type { Embedder } from "../embeddings.ts";
import type { Db } from "./db.ts";
import { relatedTo, type RelatedPage } from "./links.ts";
import { addPreference, listPreferences, removePreference } from "./preferences.ts";
import { searchDocuments } from "./search.ts";
import type { BrainSearchHit, SourceKind } from "./types.ts";
import { isUsableVector } from "./vector.ts";

export type Brain = {
  searchGmail(query: string, limit?: number): Promise<BrainSearchHit[]>;
  searchDrive(query: string, limit?: number): Promise<BrainSearchHit[]>;
  searchCalendar(query: string, limit?: number): Promise<BrainSearchHit[]>;
  getPreferences(): Promise<string[]>;
  savePreference(fact: string): Promise<{ status: "saved" | "already_known" }>;
  forgetPreference(fact: string): Promise<{ status: "removed" | "not_found" }>;
  findRelated(slug: string): Promise<{ count: number; results: RelatedPage[] }>;
};

// Read on every chat request before anything streams, so it must fail fast.
const PREFERENCES_READ_TIMEOUT_MS = 8_000;

export function createBrain(
  deps: { db: Db; embedder: Pick<Embedder, "query"> },
  options: { preferencesTimeoutMs?: number } = {},
): Brain {
  async function search(source: SourceKind, query: string, limit: number): Promise<BrainSearchHit[]> {
    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await deps.embedder.query(query);
    } catch (err) {
      // A rate-limited or failing embedding service must not make search fail:
      // keyword search still works.
      console.error("Query embedding failed; using keyword search only", err);
    }
    if (queryEmbedding !== null && !isUsableVector(queryEmbedding)) {
      // A malformed vector would make the vector SQL throw; keyword search still works.
      console.error("Query embedding was unusable (wrong size or not numbers); using keyword search only");
      queryEmbedding = null;
    }
    return searchDocuments(deps.db, { query, queryEmbedding, source, limit });
  }

  /**
   * The chat's injection read: never throws, never hangs. Save/forget below do
   * NOT use this; they propagate database errors so a failed read can never be
   * mistaken for "no preferences" by a read-modify-write.
   */
  async function getPreferences(): Promise<string[]> {
    const timeoutMs = options.preferencesTimeoutMs ?? PREFERENCES_READ_TIMEOUT_MS;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<string[]>((resolve) => {
      timer = setTimeout(() => {
        console.error(`Preferences read took over ${timeoutMs}ms; continuing without them`);
        resolve([]);
      }, timeoutMs);
    });
    const read = listPreferences(deps.db).catch((err) => {
      console.error("Failed to read preferences; continuing without them", err);
      return [] as string[];
    });
    try {
      return await Promise.race([read, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    searchGmail: (query, limit = 10) => search("gmail", query, limit),
    searchDrive: (query, limit = 10) => search("drive", query, limit),
    searchCalendar: (query, limit = 10) => search("calendar", query, limit),
    getPreferences,
    savePreference: (fact) => addPreference(deps.db, fact),
    forgetPreference: (fact) => removePreference(deps.db, fact),
    findRelated: (slug) => relatedTo(deps.db, slug),
  };
}
