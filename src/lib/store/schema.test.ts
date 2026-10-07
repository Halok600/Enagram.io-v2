import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "./test-db.ts";
import { applySchema } from "./schema.ts";

test("applySchema creates every table and is safe to run twice", async () => {
  const db = await createTestDb();
  await applySchema(db);
  await applySchema(db);
  const rows = await db.query<{ table_name: string }>(
    `select table_name from information_schema.tables
      where table_schema = 'public' and table_name like 'enagram_%' order by table_name`,
  );
  assert.deepEqual(
    rows.map((r) => r.table_name),
    ["enagram_documents", "enagram_links", "enagram_meta", "enagram_preferences"],
  );
});

test("the keyword index normalises file names so a plain word finds them", async () => {
  const db = await createTestDb();
  await applySchema(db);
  await db.query(
    `insert into enagram_documents (id, source, title, body, content_hash)
     values ('drive:cv', 'drive', 'Resume_2026_APRIL.pdf', 'x', 'h')`,
  );
  const rows = await db.query<{ id: string }>(
    `select id from enagram_documents where fts @@ to_tsquery('english', 'resume')`,
  );
  assert.deepEqual(rows.map((r) => r.id), ["drive:cv"]);
});

test("deleting a document cascades to its links", async () => {
  const db = await createTestDb();
  await applySchema(db);
  await db.query(
    `insert into enagram_documents (id, source, title, body, content_hash)
     values ('gmail:1', 'gmail', 'a', 'a', 'h'), ('drive:1', 'drive', 'b', 'b', 'h')`,
  );
  await db.query(`insert into enagram_links (from_id, to_id) values ('gmail:1', 'drive:1')`);
  await db.query(`delete from enagram_documents where id = 'gmail:1'`);
  const rows = await db.query<{ n: number }>(`select count(*)::int as n from enagram_links`);
  assert.equal(rows[0].n, 0);
});
