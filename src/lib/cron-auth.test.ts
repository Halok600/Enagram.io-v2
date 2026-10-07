import { test } from "node:test";
import assert from "node:assert/strict";
import { isAuthorizedCron } from "./cron-auth.ts";

test("accepts the exact bearer secret Vercel cron sends", () => {
  assert.equal(isAuthorizedCron("Bearer s3cret", "s3cret"), true);
});

test("rejects missing, wrong, or malformed credentials", () => {
  assert.equal(isAuthorizedCron(null, "s3cret"), false);
  assert.equal(isAuthorizedCron("Bearer wrong", "s3cret"), false);
  assert.equal(isAuthorizedCron("Bearer s3cret-but-longer", "s3cret"), false);
  assert.equal(isAuthorizedCron("s3cret", "s3cret"), false);
});

test("fails closed when CRON_SECRET is not configured", () => {
  assert.equal(isAuthorizedCron("Bearer ", undefined), false);
  assert.equal(isAuthorizedCron("Bearer ", ""), false);
  assert.equal(isAuthorizedCron("Bearer undefined", undefined), false);
});
