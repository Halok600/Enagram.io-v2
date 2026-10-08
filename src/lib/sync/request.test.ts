import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSyncRequest } from "./request.ts";

test("the known phases and auto flag are read as before", () => {
  assert.deepEqual(parseSyncRequest({ phase: "fetch", auto: true }), { phase: "fetch", auto: true });
  assert.deepEqual(parseSyncRequest({ phase: "embed" }), { phase: "embed", auto: false });
});

test("a missing phase or an empty/non-object body defaults to a fetch", () => {
  assert.deepEqual(parseSyncRequest({}), { phase: "fetch", auto: false });
  assert.deepEqual(parseSyncRequest(null), { phase: "fetch", auto: false });
  assert.deepEqual(parseSyncRequest("embed"), { phase: "fetch", auto: false });
});

test("auto is only honoured when it is exactly true", () => {
  assert.equal(parseSyncRequest({ phase: "fetch", auto: "true" })?.auto, false);
  assert.equal(parseSyncRequest({ phase: "fetch", auto: 1 })?.auto, false);
});

test("an unknown phase is rejected rather than treated as a fetch", () => {
  assert.equal(parseSyncRequest({ phase: "bogus" }), null);
  assert.equal(parseSyncRequest({ phase: "EMBED" }), null);
  assert.equal(parseSyncRequest({ phase: null }), null);
  assert.equal(parseSyncRequest({ phase: 1 }), null);
});
