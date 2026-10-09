import { test } from "node:test";
import assert from "node:assert/strict";
import { selectTapeItems } from "./tape.ts";

const idle = { state: "idle" as const };

test("nothing to say gives an empty strip", () => {
  assert.deepEqual(selectTapeItems({ sync: idle }), []);
});

test("a database problem comes first, then a chat error with Retry, then sync lines", () => {
  const items = selectTapeItems({
    dbMessage: "The database is paused.",
    chatError: "Model is busy.",
    sync: { state: "loading", progress: "12 document(s) left to index..." },
  });
  assert.deepEqual(items.map((i) => i.id), ["db", "chat-error", "sync-progress"]);
  assert.equal(items[0].tone, "alert");
  assert.equal(items[1].retry, true);
  assert.equal(items[2].tone, "working");
});

test("while syncing, progress and the waiting note both show and the finished line does not", () => {
  const items = selectTapeItems({
    sync: { state: "loading", progress: "5 left", waiting: "Waiting 40s", result: "old result" },
  });
  assert.deepEqual(items.map((i) => i.id), ["sync-progress", "sync-waiting"]);
});

test("a finished sync shows its result and any stop warning (warning is a warn tone)", () => {
  const items = selectTapeItems({ sync: { state: "done", result: "1 email(s) -> 3 document(s).", stop: "Gemini limit reached." } });
  assert.deepEqual(items.map((i) => [i.id, i.tone]), [["sync-result", "ok"], ["sync-stop", "warn"]]);
});

test("a failed sync shows its error as an alert", () => {
  const items = selectTapeItems({ sync: { state: "error", error: "Sync failed" } });
  assert.deepEqual(items.map((i) => [i.id, i.tone, i.text]), [["sync-error", "alert", "Sync failed"]]);
});

test("blank strings are ignored", () => {
  assert.deepEqual(selectTapeItems({ dbMessage: "  ", chatError: "", sync: idle }), []);
});
