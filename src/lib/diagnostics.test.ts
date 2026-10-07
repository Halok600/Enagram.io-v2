import { test } from "node:test";
import assert from "node:assert/strict";
import { timeSteps } from "./diagnostics.ts";

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
