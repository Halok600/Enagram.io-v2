import { test } from "node:test";
import assert from "node:assert/strict";
import { withTimeout } from "./with-timeout.ts";

test("a call that settles in time passes its value or error through", async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 50, "Thing"), 7);
  await assert.rejects(withTimeout(Promise.reject(new Error("boom")), 50, "Thing"), /boom/);
});

test("a call that is too slow rejects with the label and the limit", async () => {
  const slow = new Promise<number>((resolve) => setTimeout(() => resolve(1), 200));
  await assert.rejects(withTimeout(slow, 20, "Calendar fetch"), /Calendar fetch took longer than 20ms/);
});
