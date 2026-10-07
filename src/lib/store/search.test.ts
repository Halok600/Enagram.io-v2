import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, makeDoc, setVector, unitVector } from "./test-db.ts";
import { applySchema } from "./schema.ts";
import { upsertDocuments } from "./documents.ts";
import { buildTsQuery, rrfFuse, searchDocuments, vectorLiteral } from "./search.ts";

async function seededDb() {
  const db = await createTestDb();
  await applySchema(db);
  await upsertDocuments(db, [
    makeDoc({
      id: "gmail:tcs",
      title: "Update on TCS NQT (All India) Selection Process",
      body: "TCS Confidential Dear Priyanshu Tiwari, Greetings from TCS Talent Acquisition. Your selection process status is updated.",
      url: "https://mail.google.com/mail/u/0/#all/t1",
      docDate: "2026-09-25T10:00:00.000Z",
    }),
    makeDoc({
      id: "gmail:tos",
      title: "Reminder about Google's Terms of Service",
      body: "Hello, we wanted to update you. Laws in India require us to send mail reminders which came from policy.",
      docDate: "2026-10-03T10:00:00.000Z",
    }),
    makeDoc({
      id: "gmail:promo",
      title: "Your Summer Just Got a PPI Upgrade",
      body: "Update: Win 10 lakh. Check your mail, the offer which came last week has been extended.",
    }),
    makeDoc({
      id: "drive:cv",
      source: "drive",
      title: "Resume_2026_APRIL.pdf",
      body: "Priyanshu Tiwari software engineer projects skills",
    }),
    makeDoc({
      id: "calendar:e1",
      source: "calendar",
      title: "Interview with Nirmit",
      body: "When: tomorrow 3pm",
      eventId: "e1",
      docDate: "2026-10-08T09:30:00.000Z",
    }),
  ]);
  return db;
}

test("rrfFuse ranks items found by both lists above items found by one", () => {
  const fused = rrfFuse([["a", "b"], ["b", "c"]]);
  assert.deepEqual(fused.map((f) => f.id), ["b", "a", "c"]);
  assert.ok(fused[0].score > fused[1].score);
});

test("buildTsQuery ORs the alphanumeric terms, de-duplicated and capped", () => {
  assert.equal(buildTsQuery("Update me for the TCS mail?"), "update | me | for | the | tcs | mail");
  assert.equal(buildTsQuery("tcs TCS tcs"), "tcs");
  assert.equal(buildTsQuery("?! ..."), null);
  const many = Array.from({ length: 20 }, (_, i) => `w${i}`).join(" ");
  assert.equal(buildTsQuery(many)?.split(" | ").length, 12);
});

test("vectorLiteral formats a pgvector literal", () => {
  assert.equal(vectorLiteral([1, 0.5]), "[1,0.5]");
});

test("a natural-language question ranks the TCS email first (keyword side alone)", async () => {
  const db = await seededDb();
  for (const question of ["Update me for the TCS mail which came?", "Hi can you tell me my status on TCS mail?"]) {
    const hits = await searchDocuments(db, { query: question });
    assert.equal(hits[0].slug, "gmail:tcs", question);
  }
});

test("a hit carries the fields the chat tools format", async () => {
  const db = await seededDb();
  const hits = await searchDocuments(db, { query: "TCS selection" });
  const tcs = hits.find((h) => h.slug === "gmail:tcs")!;
  assert.equal(tcs.type, "email");
  assert.equal(tcs.title, "Update on TCS NQT (All India) Selection Process");
  assert.equal(tcs.url, "https://mail.google.com/mail/u/0/#all/t1");
  assert.equal(tcs.date, "2026-09-25T10:00:00.000Z");
  assert.ok(tcs.score > 0);
  assert.match(tcs.snippet, /TCS/);
  assert.equal(tcs.snippet.includes("<b>"), false);
});

test("a plain word finds a file whose name uses underscores", async () => {
  const db = await seededDb();
  const hits = await searchDocuments(db, { query: "my resume" });
  assert.equal(hits[0].slug, "drive:cv");
  assert.equal(hits[0].type, "source");
});

test("the source filter is exact", async () => {
  const db = await seededDb();
  const gmailOnly = await searchDocuments(db, { query: "Priyanshu", source: "gmail" });
  assert.deepEqual(gmailOnly.map((h) => h.slug), ["gmail:tcs"]);
  const driveOnly = await searchDocuments(db, { query: "Priyanshu", source: "drive" });
  assert.deepEqual(driveOnly.map((h) => h.slug), ["drive:cv"]);
});

test("calendar hits carry the raw event id", async () => {
  const db = await seededDb();
  const hits = await searchDocuments(db, { query: "interview", source: "calendar" });
  assert.equal(hits[0].slug, "calendar:e1");
  assert.equal(hits[0].type, "event");
  assert.equal(hits[0].eventId, "e1");
});

test("vector search finds a document with no keyword overlap, and skips unembedded ones", async () => {
  const db = await seededDb();
  await setVector(db, "gmail:tos", 0);
  await setVector(db, "gmail:promo", 1);
  const hits = await searchDocuments(db, { query: "zzzzqq", queryEmbedding: unitVector(1), limit: 5 });
  assert.deepEqual(hits.map((h) => h.slug), ["gmail:promo", "gmail:tos"]);
});

test("a document found by both keyword and vector ranks first", async () => {
  const db = await seededDb();
  await setVector(db, "gmail:tcs", 2);
  await setVector(db, "gmail:promo", 1);
  const hits = await searchDocuments(db, { query: "TCS", queryEmbedding: unitVector(2), limit: 5 });
  assert.equal(hits[0].slug, "gmail:tcs");
  assert.ok(hits[0].score > (hits[1]?.score ?? 0));
});

test("limit is honored and an empty query returns nothing", async () => {
  const db = await seededDb();
  assert.equal((await searchDocuments(db, { query: "update mail", limit: 1 })).length, 1);
  assert.deepEqual(await searchDocuments(db, { query: "?!" }), []);
});

test("the source filter is exact on the vector side too", async () => {
  const db = await seededDb();
  await setVector(db, "gmail:tos", 3);
  await setVector(db, "drive:cv", 3);
  const hits = await searchDocuments(db, { query: "zzzzqq", queryEmbedding: unitVector(3), source: "drive" });
  assert.deepEqual(hits.map((h) => h.slug), ["drive:cv"]);
});

test("a stop-word-only query matches nothing by keyword and does not throw", async () => {
  const db = await seededDb();
  assert.deepEqual(await searchDocuments(db, { query: "the me for" }), []);
  await setVector(db, "gmail:promo", 4);
  const hits = await searchDocuments(db, { query: "the me for", queryEmbedding: unitVector(4) });
  assert.deepEqual(hits.map((h) => h.slug), ["gmail:promo"]);
});

test("a vector-only hit gets a body-prefix snippet, not a keyword headline", async () => {
  const db = await seededDb();
  await upsertDocuments(db, [makeDoc({ id: "gmail:long", title: "Long note", body: "alpha beta ".repeat(200) })]);
  await setVector(db, "gmail:long", 5);
  const hits = await searchDocuments(db, { query: "zzzzqq", queryEmbedding: unitVector(5) });
  assert.equal(hits[0].slug, "gmail:long");
  assert.ok(hits[0].snippet.startsWith("alpha beta"));
  assert.ok(hits[0].snippet.length > 300, `snippet length ${hits[0].snippet.length}`);
  assert.ok(hits[0].snippet.length <= 600);
});
