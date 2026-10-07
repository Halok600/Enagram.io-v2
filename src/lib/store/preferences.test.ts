import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "./test-db.ts";
import { applySchema } from "./schema.ts";
import { addPreference, listPreferences, removePreference } from "./preferences.ts";

async function freshDb() {
  const db = await createTestDb();
  await applySchema(db);
  return db;
}

test("a saved preference is listed; saving the same fact again is already_known", async () => {
  const db = await freshDb();
  assert.deepEqual(await addPreference(db, "User prefers concise answers"), { status: "saved" });
  assert.deepEqual(await addPreference(db, "  user PREFERS concise answers "), { status: "already_known" });
  assert.deepEqual(await listPreferences(db), ["User prefers concise answers"]);
});

test("forgetting matches by substring, case-insensitively", async () => {
  const db = await freshDb();
  await addPreference(db, "User prefers concise answers");
  await addPreference(db, "User works at Acme");
  assert.deepEqual(await removePreference(db, "CONCISE"), { status: "removed" });
  assert.deepEqual(await listPreferences(db), ["User works at Acme"]);
  assert.deepEqual(await removePreference(db, "nothing like this"), { status: "not_found" });
});

test("only the newest 30 preferences are kept", async () => {
  const db = await freshDb();
  for (let i = 1; i <= 35; i++) await addPreference(db, `pref-${String(i).padStart(2, "0")}`);
  const list = await listPreferences(db);
  assert.equal(list.length, 30);
  assert.equal(list[0], "pref-06");
  assert.equal(list[29], "pref-35");
});

test("a failing database makes save and forget throw instead of silently succeeding", async () => {
  const broken = {
    query: async () => {
      throw new Error("database did not respond within 15s");
    },
    transaction: async () => {
      throw new Error("database did not respond within 15s");
    },
  };
  await assert.rejects(addPreference(broken, "x"), /did not respond/);
  await assert.rejects(removePreference(broken, "x"), /did not respond/);
});

test("forgetting an empty or whitespace-only fact deletes nothing", async () => {
  const db = await freshDb();
  await addPreference(db, "User prefers concise answers");
  await addPreference(db, "User works at Acme");
  assert.deepEqual(await removePreference(db, ""), { status: "not_found" });
  assert.deepEqual(await removePreference(db, "   "), { status: "not_found" });
  assert.deepEqual(await listPreferences(db), ["User prefers concise answers", "User works at Acme"]);
});

test("saving an empty or whitespace-only fact is rejected and inserts nothing", async () => {
  const db = await freshDb();
  await assert.rejects(addPreference(db, ""), /must not be empty/);
  await assert.rejects(addPreference(db, "  "), /must not be empty/);
  assert.deepEqual(await listPreferences(db), []);
});
