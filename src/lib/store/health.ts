import type { Db } from "./db.ts";
import { countDocuments } from "./documents.ts";
import { getMeta } from "./meta.ts";

/** A real round-trip to Postgres: this is also what keeps a free-tier Supabase project from pausing. */
export async function checkHealth(db: Db): Promise<{ documents: number; lastSyncedAt: string | null }> {
  await db.query(`select 1`);
  const documents = await countDocuments(db);
  const last = await getMeta(db, "last_synced_at");
  const ms = last === null ? Number.NaN : Number(last);
  return { documents, lastSyncedAt: Number.isFinite(ms) ? new Date(ms).toISOString() : null };
}
