import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, makeDoc } from "./test-db.ts";
import { applySchema } from "./schema.ts";
import { upsertDocuments } from "./documents.ts";
import { setMeta } from "./meta.ts";
import { checkHealth } from "./health.ts";

test("health reports the document count and last sync time", async () => {
  const db = await createTestDb();
  await applySchema(db);
  assert.deepEqual(await checkHealth(db), { documents: 0, lastSyncedAt: null });
  await upsertDocuments(db, [makeDoc({ id: "gmail:1" }), makeDoc({ id: "gmail:2" })]);
  await setMeta(db, "last_synced_at", "1000");
  assert.deepEqual(await checkHealth(db), { documents: 2, lastSyncedAt: "1970-01-01T00:00:01.000Z" });
});

test("health throws when the database fails", async () => {
  const broken = { query: () => Promise.reject(new Error("down")), transaction: () => Promise.reject(new Error("down")) };
  await assert.rejects(checkHealth(broken), /down/);
});

test("a blank, non-numeric or out-of-range last_synced_at is reported as never synced", async () => {
  const db = await createTestDb();
  await applySchema(db);
  for (const bad of ["", "   ", "abc", "NaN", "Infinity", "9999999999999999", "-5", "0"]) {
    await setMeta(db, "last_synced_at", bad);
    assert.deepEqual(await checkHealth(db), { documents: 0, lastSyncedAt: null }, JSON.stringify(bad));
  }
});
