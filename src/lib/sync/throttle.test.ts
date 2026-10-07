import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTO_SYNC_MIN_INTERVAL_MS, shouldAutoSync } from "./throttle.ts";

test("never synced, or an unreadable timestamp, means sync", () => {
  assert.equal(shouldAutoSync(null, 1_000_000), true);
  assert.equal(shouldAutoSync(Number.NaN, 1_000_000), true);
});

test("a sync within the last 10 minutes is skipped; at 10 minutes it runs", () => {
  const now = 10_000_000;
  assert.equal(shouldAutoSync(now - 5 * 60_000, now), false);
  assert.equal(shouldAutoSync(now - AUTO_SYNC_MIN_INTERVAL_MS, now), true);
  assert.equal(shouldAutoSync(now - AUTO_SYNC_MIN_INTERVAL_MS - 1, now), true);
});
