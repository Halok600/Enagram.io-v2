import type { Db } from "./db.ts";
import { countDocuments } from "./documents.ts";
import { getMeta } from "./meta.ts";

/** Only a positive, in-range millisecond timestamp counts; anything else is "never synced". */
function msToIso(value: string | null): string | null {
  if (value === null || value.trim() === "") return null;
  const ms = Number(value);
  if (!(ms > 0)) return null; // NaN, zero and negatives are never a real sync time
  const date = new Date(ms);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** A real round-trip to Postgres: this is also what keeps a free-tier Supabase project from pausing. */
export async function checkHealth(db: Db): Promise<{ documents: number; lastSyncedAt: string | null }> {
  await db.query(`select 1`);
  const documents = await countDocuments(db);
  const last = await getMeta(db, "last_synced_at");
  return { documents, lastSyncedAt: msToIso(last) };
}
