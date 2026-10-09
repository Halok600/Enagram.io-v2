import { test } from "node:test";
import assert from "node:assert/strict";
import { syncResultLine } from "./sync-line.ts";

test("full result with counts and changes", () => {
  assert.equal(
    syncResultLine({ counts: { gmail: 100, drive: 61, calendar: 2 }, documents: 163, changed: 5 }),
    "100 email(s) + 61 file(s) + 2 event(s) → 163 document(s), 5 updated.",
  );
});

test("no changes and no counts", () => {
  assert.equal(syncResultLine({ documents: 163, changed: 0 }), "163 document(s) (no changes).");
});
