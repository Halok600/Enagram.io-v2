import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "./test-db.ts";
import { applySchema } from "./schema.ts";
import { getMeta, setMeta } from "./meta.ts";

test("meta values can be set, overwritten and read; a missing key is null", async () => {
  const db = await createTestDb();
  await applySchema(db);
  assert.equal(await getMeta(db, "last_synced_at"), null);
  await setMeta(db, "last_synced_at", "100");
  await setMeta(db, "last_synced_at", "200");
  assert.equal(await getMeta(db, "last_synced_at"), "200");
});
