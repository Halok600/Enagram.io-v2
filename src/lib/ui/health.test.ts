import { test } from "node:test";
import assert from "node:assert/strict";
import { HEALTH_LOADING, HEALTH_UNREACHABLE, healthToView } from "./health.ts";

test("an ok response carries the document count", () => {
  assert.deepEqual(healthToView({ db: "ok", documents: 163, lastSyncedAt: "x" }), { status: "ok", documents: 163 });
});

test("a down response has no count", () => {
  assert.deepEqual(healthToView({ db: "down", reason: "paused" }), { status: "down", documents: null });
});

test("garbage is treated as unreachable and a non-number count as null", () => {
  assert.deepEqual(healthToView(null), HEALTH_UNREACHABLE);
  assert.deepEqual(healthToView("nope"), HEALTH_UNREACHABLE);
  assert.deepEqual(healthToView({ db: "ok", documents: "many" }), { status: "ok", documents: null });
  assert.equal(HEALTH_LOADING.status, "loading");
});

test("db ok without a documents field has a null count", () => {
  assert.deepEqual(healthToView({ db: "ok" }), { status: "ok", documents: null });
});

test("an unknown db value is treated as unreachable", () => {
  assert.deepEqual(healthToView({ db: "weird" }), HEALTH_UNREACHABLE);
});
