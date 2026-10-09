import { test } from "node:test";
import assert from "node:assert/strict";
import { tickerText, toolLabel } from "./tool-label.ts";

test("known tools have short uppercase labels", () => {
  assert.equal(toolLabel("search_gmail"), "SEARCHING GMAIL");
  assert.equal(toolLabel("delete_calendar_event"), "DELETING AN EVENT");
});

test("unknown tools get a generic label", () => {
  assert.equal(toolLabel("something_new"), "WORKING");
});

test("names that exist on Object.prototype are not tools", () => {
  assert.equal(toolLabel("toString"), "WORKING");
  assert.equal(toolLabel("__proto__"), "WORKING");
  assert.equal(toolLabel("constructor"), "WORKING");
  assert.equal(toolLabel("hasOwnProperty"), "WORKING");
});

test("ticker joins unique labels and falls back when nothing is running", () => {
  assert.equal(tickerText(["search_gmail", "search_drive", "search_gmail"]), "SEARCHING GMAIL  •  SEARCHING DRIVE");
  assert.equal(tickerText([]), "THINKING");
});
