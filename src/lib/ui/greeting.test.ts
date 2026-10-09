import { test } from "node:test";
import assert from "node:assert/strict";
import { SUGGESTIONS, firstName } from "./greeting.ts";

test("firstName takes the first word, trimmed", () => {
  assert.equal(firstName("  Sam Example "), "Sam");
});

test("firstName returns null for missing or blank names", () => {
  assert.equal(firstName(undefined), null);
  assert.equal(firstName("   "), null);
});

test("there are exactly four generic suggestions with unique ids and no personal names", () => {
  assert.equal(SUGGESTIONS.length, 4);
  assert.equal(new Set(SUGGESTIONS.map((s) => s.id)).size, 4);
  for (const s of SUGGESTIONS) assert.ok(s.text.length > 8 && s.text.length < 60);
});
