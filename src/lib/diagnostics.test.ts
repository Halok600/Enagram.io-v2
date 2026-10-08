import { test } from "node:test";
import assert from "node:assert/strict";
import { redactConnectionStrings, timeSteps } from "./diagnostics.ts";

test("timeSteps runs steps in order, timing each, and records failures instead of throwing", async () => {
  let clock = 0;
  const timings = await timeSteps(
    [
      { call: "fast", run: async () => void (clock += 5) },
      {
        call: "broken",
        run: async () => {
          clock += 40;
          throw new Error("nope");
        },
      },
      { call: "after", run: async () => void (clock += 1) },
    ],
    () => clock,
  );
  assert.deepEqual(timings, [
    { call: "fast", ok: true, ms: 5 },
    { call: "broken", ok: false, ms: 40, error: "nope" },
    { call: "after", ok: true, ms: 1 },
  ]);
});

test("redactConnectionStrings removes postgres URLs (with credentials) and keeps the rest", () => {
  assert.equal(
    redactConnectionStrings("connect failed for postgresql://postgres.ref:s3cret@aws-0.pooler.supabase.com:6543/postgres?sslmode=require, retrying"),
    "connect failed for [redacted] retrying",
  );
  assert.equal(redactConnectionStrings("bad url POSTGRES://u:p@h/db and postgres://x@y/z"), "bad url [redacted] and [redacted]");
  assert.equal(redactConnectionStrings("database did not respond within 15s"), "database did not respond within 15s");
});

test("timeSteps never returns a connection string from a failing step", async () => {
  const [timing] = await timeSteps([
    {
      call: "database ping",
      run: async () => {
        throw new Error("invalid connection string postgresql://u:pw@host:6543/db");
      },
    },
  ]);
  assert.equal(timing.error, "invalid connection string [redacted]");
  assert.ok(!JSON.stringify(timing).includes("pw@"));
});
