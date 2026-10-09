import { test } from "node:test";
import assert from "node:assert/strict";
import { extractSources } from "./extractSources.ts";

const hit = { title: "Quarterly plan", slug: "gmail-1", score: 0.9, url: "https://example.com/1" };

test("sources come only from finished search parts", () => {
  const sources = extractSources([
    { type: "tool-search_gmail", state: "output-available", output: { results: [hit] } },
    { type: "tool-search_drive", state: "input-available" },
  ]);
  assert.deepEqual(
    sources.map((s) => s.slug),
    ["gmail-1"],
  );
});

test("approval states on write tools are ignored and do not disturb the sources", () => {
  const sources = extractSources([
    { type: "tool-save_preference", state: "approval-requested" },
    { type: "tool-delete_calendar_event", state: "approval-responded" },
    { type: "tool-update_calendar_event", state: "output-denied" },
    { type: "tool-search_gmail", state: "output-available", output: { results: [hit] } },
  ]);
  assert.equal(sources.length, 1);
});
