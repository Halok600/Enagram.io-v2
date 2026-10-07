import type { Db } from "./db.ts";

export async function getMeta(db: Db, key: string): Promise<string | null> {
  const rows = await db.query<{ value: string }>(`select value from enagram_meta where key = $1::text`, [key]);
  return rows[0]?.value ?? null;
}

export async function setMeta(db: Db, key: string, value: string): Promise<void> {
  await db.query(
    `insert into enagram_meta (key, value) values ($1::text, $2::text)
     on conflict (key) do update set value = excluded.value`,
    [key, value],
  );
}
