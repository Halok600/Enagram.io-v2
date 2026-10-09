import { test } from "node:test";
import assert from "node:assert/strict";
import { CONFIRM_DELAY_MS, canConfirmDelete } from "./delete-confirm.ts";

test("the delay is 700 ms", () => {
  assert.equal(CONFIRM_DELAY_MS, 700);
});

test("not armed: never confirms", () => {
  assert.equal(canConfirmDelete(null, 5000, 1), false);
});

test("0 ms after arming: ignored (a double-click)", () => {
  assert.equal(canConfirmDelete(1000, 1000, 1), false);
});

test("699 ms after arming: still ignored", () => {
  assert.equal(canConfirmDelete(1000, 1699, 1), false);
});

test("700 ms after arming: confirms", () => {
  assert.equal(canConfirmDelete(1000, 1700, 1), true);
});

test("a repeated click of a multi-click (detail 2) never confirms, even after 5000 ms", () => {
  assert.equal(canConfirmDelete(1000, 6000, 2), false);
});

test("a single click after 5000 ms confirms", () => {
  assert.equal(canConfirmDelete(1000, 6000, 1), true);
});

test("keyboard activation (detail 0) after the delay confirms", () => {
  assert.equal(canConfirmDelete(1000, 2000, 0), true);
});
