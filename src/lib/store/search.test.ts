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
      id: "gmail:acme",
      title: "Update on your Acme Corp application",
      body: "Acme Corp Confidential Dear Pat Example, thank you for applying to the Platform Engineer role. Your application status is updated.",
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
      body: "Pat Example software engineer projects skills",
    }),
    makeDoc({
      id: "calendar:e1",
      source: "calendar",
      title: "Interview with Priya",
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
  assert.equal(buildTsQuery("Update me for the Acme mail?"), "update | me | for | the | acme | mail");
  assert.equal(buildTsQuery("acme Acme acme"), "acme");
  assert.equal(buildTsQuery("?! ..."), null);
  const many = Array.from({ length: 20 }, (_, i) => `w${i}`).join(" ");
  assert.equal(buildTsQuery(many)?.split(" | ").length, 12);
});

test("vectorLiteral formats a pgvector literal", () => {
  assert.equal(vectorLiteral([1, 0.5]), "[1,0.5]");
});

test("a natural-language question ranks the Acme email first (keyword side alone)", async () => {
  const db = await seededDb();
  for (const question of ["Update me for the Acme mail which came?", "Hi can you tell me my status on Acme mail?"]) {
    const hits = await searchDocuments(db, { query: question });
    assert.equal(hits[0].slug, "gmail:acme", question);
  }
});

test("a hit carries the fields the chat tools format", async () => {
  const db = await seededDb();
  const hits = await searchDocuments(db, { query: "Acme application" });
  const acme = hits.find((h) => h.slug === "gmail:acme")!;
  assert.equal(acme.type, "email");
  assert.equal(acme.title, "Update on your Acme Corp application");
  assert.equal(acme.url, "https://mail.google.com/mail/u/0/#all/t1");
  assert.equal(acme.date, "2026-09-25T10:00:00.000Z");
  assert.ok(acme.score > 0);
  assert.match(acme.snippet, /Acme/);
  assert.equal(acme.snippet.includes("<b>"), false);
});

test("a plain word finds a file whose name uses underscores", async () => {
  const db = await seededDb();
  const hits = await searchDocuments(db, { query: "my resume" });
  assert.equal(hits[0].slug, "drive:cv");
  assert.equal(hits[0].type, "source");
});

test("the source filter is exact", async () => {
  const db = await seededDb();
  const gmailOnly = await searchDocuments(db, { query: "Pat", source: "gmail" });
  assert.deepEqual(gmailOnly.map((h) => h.slug), ["gmail:acme"]);
  const driveOnly = await searchDocuments(db, { query: "Pat", source: "drive" });
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
  await setVector(db, "gmail:acme", 2);
  await setVector(db, "gmail:promo", 1);
  const hits = await searchDocuments(db, { query: "Acme", queryEmbedding: unitVector(2), limit: 5 });
  assert.equal(hits[0].slug, "gmail:acme");
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

test("buildTsQuery keeps combining marks inside a word (decomposed accents, Devanagari)", () => {
  assert.equal(buildTsQuery("café au lait"), "café | au | lait");
  assert.equal(buildTsQuery("हिन्दी भाषा"), "हिन्दी | भाषा");
});

test("a keyword search finds accented and Devanagari text without throwing", async () => {
  const db = await seededDb();
  await upsertDocuments(db, [
    makeDoc({ id: "gmail:cafe", title: "Reservation", body: "Table booked at the café on Friday" }),
    makeDoc({ id: "gmail:hindi", title: "Note", body: "यह हिन्दी भाषा का लेख है" }),
  ]);
  const accented = await searchDocuments(db, { query: "café" });
  assert.ok(accented.some((h) => h.slug === "gmail:cafe"));
  const hindi = await searchDocuments(db, { query: "हिन्दी" });
  assert.ok(hindi.some((h) => h.slug === "gmail:hindi"));
});

test("a literal <b> in the body survives in a vector-only snippet (no headline to strip)", async () => {
  const db = await seededDb();
  await upsertDocuments(db, [makeDoc({ id: "gmail:html", title: "Markup", body: "Use the <b>bold</b> tag for emphasis" })]);
  await setVector(db, "gmail:html", 6);
  const hits = await searchDocuments(db, { query: "zzzzqq", queryEmbedding: unitVector(6) });
  assert.equal(hits[0].slug, "gmail:html");
  assert.equal(hits[0].snippet, "Use the <b>bold</b> tag for emphasis");
});

test("keyword snippets never leak the highlight markers", async () => {
  const db = await seededDb();
  await upsertDocuments(db, [
    makeDoc({ id: "gmail:quokka", title: "Markup", body: "Use the <b>quokka</b> tag for emphasis in quokka notes" }),
  ]);
  const hits = await searchDocuments(db, { query: "quokka" });
  assert.equal(hits[0].slug, "gmail:quokka");
  assert.ok(hits[0].snippet.includes("quokka"));
  assert.ok(!hits[0].snippet.includes("@@"), hits[0].snippet);
  // Highlighting with the default <b> tags (i.e. without our unique markers) would put them in the snippet.
  assert.ok(!hits[0].snippet.includes("<b>"), hits[0].snippet);
  assert.equal(hits[0].snippet, "quokka tag for emphasis in quokka notes");
});
