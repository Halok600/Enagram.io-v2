import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrainDocument } from "../brain/types.ts";
import { toStoredDocument } from "./to-stored.ts";

const base: BrainDocument = {
  id: "gmail:1",
  source: "gmail",
  title: "Subject",
  body: "Body",
  participants: ["a@x.com"],
  attachments: [],
  timestamp: "2026-10-01T00:00:00Z",
  url: "https://mail.google.com/mail/u/0/#all/t1",
  raw: {},
};

test("a Gmail document maps field for field, with an ISO date and no event id", () => {
  assert.deepEqual(toStoredDocument(base), {
    id: "gmail:1",
    source: "gmail",
    title: "Subject",
    body: "Body",
    url: "https://mail.google.com/mail/u/0/#all/t1",
    docDate: "2026-10-01T00:00:00.000Z",
    participants: ["a@x.com"],
    eventId: null,
  });
});

test("a calendar document keeps the raw Google event id", () => {
  const stored = toStoredDocument({ ...base, id: "calendar:abc", source: "calendar", raw: { id: "abc" } });
  assert.equal(stored.eventId, "abc");
});

test("an unparseable timestamp becomes null instead of breaking the insert", () => {
  assert.equal(toStoredDocument({ ...base, timestamp: "" }).docDate, null);
  assert.equal(toStoredDocument({ ...base, timestamp: "not a date" }).docDate, null);
});

test("an all-day event date (no time) is accepted", () => {
  assert.equal(toStoredDocument({ ...base, timestamp: "2026-10-08" }).docDate, "2026-10-08T00:00:00.000Z");
});

test("a missing url becomes null", () => {
  assert.equal(toStoredDocument({ ...base, url: undefined }).url, null);
});
