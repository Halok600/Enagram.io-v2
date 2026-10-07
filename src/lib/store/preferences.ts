import type { Db } from "./db.ts";

const MAX_PREFERENCES = 30;

/**
 * Save/forget throw when the database fails. There is no "fail soft" variant
 * here on purpose: the chat's tolerant read lives in brain.ts, and a failed read
 * must never be mistaken for "no preferences" by a read-modify-write caller.
 */
export async function listPreferences(db: Db): Promise<string[]> {
  const rows = await db.query<{ fact: string }>(`select fact from enagram_preferences order by id`);
  return rows.map((r) => r.fact);
}

export async function addPreference(db: Db, fact: string): Promise<{ status: "saved" | "already_known" }> {
  const trimmed = fact.trim();
  if (!trimmed) throw new Error("Preference text must not be empty");
  const known = await db.query<{ id: number }>(
    `select id from enagram_preferences where position(lower($1::text) in lower(fact)) > 0 limit 1`,
    [trimmed],
  );
  if (known.length > 0) return { status: "already_known" };

  await db.query(`insert into enagram_preferences (fact) values ($1::text)`, [trimmed]);
  await db.query(
    `delete from enagram_preferences
      where id not in (select id from enagram_preferences order by id desc limit ${MAX_PREFERENCES})`,
  );
  return { status: "saved" };
}

export async function removePreference(db: Db, fact: string): Promise<{ status: "removed" | "not_found" }> {
  const trimmed = fact.trim();
  if (!trimmed) return { status: "not_found" }; // an empty needle matches every row
  const removed = await db.query<{ id: number }>(
    `delete from enagram_preferences where position(lower($1::text) in lower(fact)) > 0 returning id`,
    [trimmed],
  );
  return { status: removed.length > 0 ? "removed" : "not_found" };
}
