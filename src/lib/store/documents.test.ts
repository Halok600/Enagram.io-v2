import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, makeDoc, setVector, unitVector } from "./test-db.ts";
import { applySchema } from "./schema.ts";
import {
  EMBED_TEXT_CHARS,
  contentHash,
  countDocuments,
  countPending,
  deleteCalendarExcept,
  embeddingText,
  pendingEmbeddings,
  setEmbeddings,
  upsertDocuments,
} from "./documents.ts";

async function freshDb() {
  const db = await createTestDb();
  await applySchema(db);
  return db;
}

test("contentHash is stable and changes when the text changes", () => {
  const a = makeDoc({ id: "gmail:1", body: "hello" });
  assert.equal(contentHash(a), contentHash({ ...a }));
  assert.notEqual(contentHash(a), contentHash({ ...a, body: "hello!" }));
});

test("upsertDocuments inserts new documents and reports them as changed", async () => {
  const db = await freshDb();
  const result = await upsertDocuments(db, [makeDoc({ id: "gmail:1" }), makeDoc({ id: "drive:1", source: "drive" })]);
  assert.deepEqual(result, { total: 2, changed: 2 });
  assert.equal(await countDocuments(db), 2);
  assert.equal(await countPending(db), 2);
});

test("an unchanged document is left alone and keeps its embedding", async () => {
  const db = await freshDb();
  const doc = makeDoc({ id: "gmail:1" });
  await upsertDocuments(db, [doc]);
  await setVector(db, "gmail:1", 3);
  const again = await upsertDocuments(db, [doc]);
  assert.deepEqual(again, { total: 1, changed: 0 });
  assert.equal(await countPending(db), 0);
});

test("a changed document is stored again and its embedding is cleared", async () => {
  const db = await freshDb();
  await upsertDocuments(db, [makeDoc({ id: "gmail:1", body: "old" })]);
  await setVector(db, "gmail:1", 3);
  const result = await upsertDocuments(db, [makeDoc({ id: "gmail:1", body: "new" })]);
  assert.equal(result.changed, 1);
  assert.equal(await countPending(db), 1);
  const rows = await db.query<{ body: string }>(`select body from enagram_documents where id = 'gmail:1'`);
  assert.equal(rows[0].body, "new");
});

test("participants, url, date and calendar event id are stored", async () => {
  const db = await freshDb();
  await upsertDocuments(db, [
    makeDoc({
      id: "calendar:e1",
      source: "calendar",
      participants: ["a@x.com", "b@x.com"],
      url: "https://calendar.example/e1",
      docDate: "2026-10-08T09:30:00.000Z",
      eventId: "e1",
    }),
  ]);
  const rows = await db.query<{ participants: string[]; url: string; event_id: string; doc_date: Date }>(
    `select participants, url, event_id, doc_date from enagram_documents where id = 'calendar:e1'`,
  );
  assert.deepEqual(rows[0].participants, ["a@x.com", "b@x.com"]);
  assert.equal(rows[0].url, "https://calendar.example/e1");
  assert.equal(rows[0].event_id, "e1");
  assert.equal(new Date(rows[0].doc_date).toISOString(), "2026-10-08T09:30:00.000Z");
});

test("NUL characters (which Postgres text rejects) are stripped", async () => {
  const db = await freshDb();
  await upsertDocuments(db, [makeDoc({ id: "drive:1", source: "drive", body: "a\u0000b" })]);
  const rows = await db.query<{ body: string }>(`select body from enagram_documents where id = 'drive:1'`);
  assert.equal(rows[0].body, "ab");
});

test("deleteCalendarExcept removes only stale calendar documents", async () => {
  const db = await freshDb();
  await upsertDocuments(db, [
    makeDoc({ id: "gmail:1" }),
    makeDoc({ id: "calendar:a", source: "calendar" }),
    makeDoc({ id: "calendar:b", source: "calendar" }),
  ]);
  const removed = await deleteCalendarExcept(db, ["calendar:a"]);
  assert.equal(removed, 1);
  const rows = await db.query<{ id: string }>(`select id from enagram_documents order by id`);
  assert.deepEqual(rows.map((r) => r.id), ["calendar:a", "gmail:1"]);
});

test("deleteCalendarExcept with an empty keep list deletes every calendar document but nothing else", async () => {
  const db = await freshDb();
  await upsertDocuments(db, [
    makeDoc({ id: "gmail:1" }),
    makeDoc({ id: "calendar:a", source: "calendar" }),
    makeDoc({ id: "calendar:b", source: "calendar" }),
  ]);
  const removed = await deleteCalendarExcept(db, []);
  assert.equal(removed, 2);
  const rows = await db.query<{ id: string }>(`select id from enagram_documents order by id`);
  assert.deepEqual(rows.map((r) => r.id), ["gmail:1"]);
});

test("pendingEmbeddings returns title plus a truncated body", async () => {
  const db = await freshDb();
  await upsertDocuments(db, [makeDoc({ id: "gmail:1", title: "Subject", body: "x".repeat(10_000) })]);
  const pending = await pendingEmbeddings(db, 10);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].id, "gmail:1");
  assert.equal(pending[0].text, embeddingText("Subject", "x".repeat(EMBED_TEXT_CHARS)));
  assert.equal(pending[0].text.length, "Subject".length + 2 + EMBED_TEXT_CHARS);
});

test("setEmbeddings stores vectors, and ignores a stale hash", async () => {
  const db = await freshDb();
  await upsertDocuments(db, [makeDoc({ id: "gmail:1", body: "v1" }), makeDoc({ id: "gmail:2", body: "v1" })]);
  const pending = await pendingEmbeddings(db, 10);
  const byId = new Map(pending.map((p) => [p.id, p]));

  // gmail:2 changes while its embedding is being computed
  await upsertDocuments(db, [makeDoc({ id: "gmail:2", body: "v2" })]);

  await setEmbeddings(db, [
    { id: "gmail:1", hash: byId.get("gmail:1")!.hash, embedding: unitVector(0) },
    { id: "gmail:2", hash: byId.get("gmail:2")!.hash, embedding: unitVector(1) },
  ]);

  const rows = await db.query<{ id: string; has: boolean }>(
    `select id, embedding is not null as has from enagram_documents order by id`,
  );
  assert.deepEqual(rows, [
    { id: "gmail:1", has: true },
    { id: "gmail:2", has: false },
  ]);
});
