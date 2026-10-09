import { test } from "node:test";
import assert from "node:assert/strict";
import { peekToView } from "./peek.ts";

const FAIL = { status: "error", message: "Couldn't load calendar summary" };

test("an ok summary keeps the count and the events", () => {
  const view = peekToView({
    eventCountThisMonth: 7,
    upcoming: [
      { summary: "Standup", start: "2026-10-12T09:00:00+02:00", htmlLink: "https://calendar.google.com/event?eid=a" },
      { summary: "Offsite", start: "2026-10-15", htmlLink: "https://calendar.google.com/event?eid=b" },
    ],
  });
  assert.deepEqual(view, {
    status: "ok",
    count: 7,
    items: [
      { key: "2026-10-12T09:00:00+02:00|0", title: "Standup", start: "2026-10-12T09:00:00+02:00", href: "https://calendar.google.com/event?eid=a" },
      { key: "2026-10-15|1", title: "Offsite", start: "2026-10-15", href: "https://calendar.google.com/event?eid=b" },
    ],
  });
});

test("an empty upcoming list is still ok", () => {
  assert.deepEqual(peekToView({ eventCountThisMonth: 0, upcoming: [] }), { status: "ok", count: 0, items: [] });
});

test("at most 3 items are kept", () => {
  const upcoming = [1, 2, 3, 4, 5].map((n) => ({ summary: `E${n}`, start: `2026-10-0${n}`, htmlLink: "https://x.example/" }));
  const view = peekToView({ eventCountThisMonth: 5, upcoming });
  assert.equal(view.status, "ok");
  if (view.status === "ok") assert.deepEqual(view.items.map((i) => i.title), ["E1", "E2", "E3"]);
});

test("a missing or non-string summary becomes (No title)", () => {
  const view = peekToView({
    eventCountThisMonth: 2,
    upcoming: [{ start: "2026-10-01", htmlLink: "https://x.example/" }, { summary: 42, start: "2026-10-02", htmlLink: "https://x.example/" }],
  });
  assert.equal(view.status, "ok");
  if (view.status === "ok") assert.deepEqual(view.items.map((i) => i.title), ["(No title)", "(No title)"]);
});

test("items without a string start are dropped, and the key keeps the original index", () => {
  const view = peekToView({
    eventCountThisMonth: 3,
    upcoming: [{ summary: "Bad", htmlLink: "https://x.example/" }, null, "text", { summary: "Good", start: "2026-10-03" }],
  });
  assert.equal(view.status, "ok");
  if (view.status === "ok") {
    assert.equal(view.items.length, 1);
    assert.equal(view.items[0].title, "Good");
    assert.equal(view.items[0].key, "2026-10-03|3");
  }
});

test("dropped items do not use up the 3 slots", () => {
  const upcoming = [null, { summary: "A", start: "2026-10-01" }, { summary: "B", start: "2026-10-02" }, { summary: "C", start: "2026-10-03" }, { summary: "D", start: "2026-10-04" }];
  const view = peekToView({ eventCountThisMonth: 4, upcoming });
  assert.equal(view.status, "ok");
  if (view.status === "ok") assert.deepEqual(view.items.map((i) => i.title), ["A", "B", "C"]);
});

test("an unsafe or missing link becomes null", () => {
  const view = peekToView({
    eventCountThisMonth: 3,
    upcoming: [
      { summary: "JS", start: "2026-10-01", htmlLink: "javascript:alert(1)" },
      { summary: "Data", start: "2026-10-02", htmlLink: "data:text/html,x" },
      { summary: "None", start: "2026-10-03" },
    ],
  });
  assert.equal(view.status, "ok");
  if (view.status === "ok") assert.deepEqual(view.items.map((i) => i.href), [null, null, null]);
});

test("an error object gives its message", () => {
  assert.deepEqual(peekToView({ error: "Google asked you to sign in again" }), { status: "error", message: "Google asked you to sign in again" });
});

test("an error that is not a string, or garbage, gives the generic message", () => {
  assert.deepEqual(peekToView({ error: 500 }), FAIL);
  assert.deepEqual(peekToView(null), FAIL);
  assert.deepEqual(peekToView(undefined), FAIL);
  assert.deepEqual(peekToView("oops"), FAIL);
  assert.deepEqual(peekToView(12), FAIL);
  assert.deepEqual(peekToView([]), FAIL);
  assert.deepEqual(peekToView({}), FAIL);
  assert.deepEqual(peekToView({ eventCountThisMonth: 3 }), FAIL);
  assert.deepEqual(peekToView({ upcoming: [] }), FAIL);
  assert.deepEqual(peekToView({ eventCountThisMonth: "3", upcoming: [] }), FAIL);
  assert.deepEqual(peekToView({ eventCountThisMonth: 3, upcoming: "none" }), FAIL);
});

test("a negative or non-finite count is a failure", () => {
  assert.deepEqual(peekToView({ eventCountThisMonth: -1, upcoming: [] }), FAIL);
  assert.deepEqual(peekToView({ eventCountThisMonth: Number.NaN, upcoming: [] }), FAIL);
  assert.deepEqual(peekToView({ eventCountThisMonth: Number.POSITIVE_INFINITY, upcoming: [] }), FAIL);
});

test("an error message wins over a valid-looking summary", () => {
  assert.deepEqual(peekToView({ error: "nope", eventCountThisMonth: 3, upcoming: [] }), { status: "error", message: "nope" });
});

test("an empty error message falls back to the generic one", () => {
  assert.deepEqual(peekToView({ error: "  " }), FAIL);
});
