import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb, makeDoc } from "./test-db.ts";
import { applySchema } from "./schema.ts";
import { upsertDocuments } from "./documents.ts";
import { buildLinkPairs, rebuildLinks, relatedTo, replaceLinks, type LinkCandidate } from "./links.ts";

const c = (id: string, source: LinkCandidate["source"], participants: string[]): LinkCandidate => ({
  id,
  source,
  participants,
});

test("buildLinkPairs links only documents from different sources that share a participant", () => {
  const pairs = buildLinkPairs(
    [c("gmail:1", "gmail", ["a@x.com"]), c("drive:1", "drive", ["a@x.com"]), c("gmail:2", "gmail", ["a@x.com"])],
    "me@x.com",
  );
  assert.deepEqual(pairs, [
    { from: "gmail:1", to: "drive:1" },
    { from: "drive:1", to: "gmail:2" },
  ]);
});

test("buildLinkPairs ignores the user's own address, case-insensitively", () => {
  const pairs = buildLinkPairs(
    [c("gmail:1", "gmail", ["Me@X.com"]), c("drive:1", "drive", ["me@x.com"])],
    "me@x.com",
  );
  assert.deepEqual(pairs, []);
});

test("buildLinkPairs ignores participants that appear in more than 6 documents", () => {
  const docs = Array.from({ length: 7 }, (_, i) =>
    c(`${i % 2 ? "gmail" : "drive"}:${i}`, i % 2 ? "gmail" : "drive", ["list@x.com"]),
  );
  assert.deepEqual(buildLinkPairs(docs, "me@x.com"), []);
});

test("buildLinkPairs caps the total at 200", () => {
  const docs: LinkCandidate[] = [];
  for (let p = 0; p < 70; p++) {
    for (let i = 0; i < 3; i++) {
      docs.push(c(`gmail:${p}-${i}`, "gmail", [`p${p}@x.com`]));
      docs.push(c(`drive:${p}-${i}`, "drive", [`p${p}@x.com`]));
    }
  }
  assert.equal(buildLinkPairs(docs, "me@x.com").length, 200);
});

test("replaceLinks and relatedTo round-trip, in both directions", async () => {
  const db = await createTestDb();
  await applySchema(db);
  await upsertDocuments(db, [
    makeDoc({ id: "gmail:1", title: "Thread", url: "https://mail/1", docDate: "2026-10-01T00:00:00.000Z" }),
    makeDoc({ id: "drive:1", source: "drive", title: "File" }),
    makeDoc({ id: "calendar:1", source: "calendar", title: "Event" }),
  ]);
  await replaceLinks(db, [
    { from: "gmail:1", to: "drive:1" },
    { from: "gmail:1", to: "calendar:1" },
  ]);

  const fromGmail = await relatedTo(db, "gmail:1");
  assert.equal(fromGmail.count, 2);
  assert.deepEqual(fromGmail.results.map((r) => r.slug).sort(), ["calendar:1", "drive:1"]);

  const fromDrive = await relatedTo(db, "drive:1");
  assert.equal(fromDrive.count, 1);
  assert.equal(fromDrive.results[0].slug, "gmail:1");
  assert.equal(fromDrive.results[0].type, "email");
  assert.equal(fromDrive.results[0].url, "https://mail/1");
  assert.equal(fromDrive.results[0].date, "2026-10-01T00:00:00.000Z");

  assert.deepEqual(await relatedTo(db, "nope"), { count: 0, results: [] });
});

test("rebuildLinks derives links from stored participants and replaces the old ones", async () => {
  const db = await createTestDb();
  await applySchema(db);
  await upsertDocuments(db, [
    makeDoc({ id: "gmail:1", participants: ["priya@x.com", "me@x.com"] }),
    makeDoc({ id: "calendar:1", source: "calendar", participants: ["priya@x.com"] }),
    makeDoc({ id: "drive:1", source: "drive", participants: ["other@x.com"] }),
  ]);
  await replaceLinks(db, [{ from: "gmail:1", to: "drive:1" }]); // stale link

  assert.equal(await rebuildLinks(db, "me@x.com"), 1);
  assert.equal((await relatedTo(db, "gmail:1")).results[0].slug, "calendar:1");
  assert.equal((await relatedTo(db, "drive:1")).count, 0);
});

test("rebuildLinks keeps the same 200 links regardless of stored row order", async () => {
  const db = await createTestDb();
  await applySchema(db);
  const docs = [];
  for (let p = 0; p < 70; p++) {
    for (let i = 0; i < 3; i++) {
      docs.push(makeDoc({ id: `gmail:${p}-${i}`, source: "gmail", participants: [`p${p}@x.com`] }));
      docs.push(makeDoc({ id: `drive:${p}-${i}`, source: "drive", participants: [`p${p}@x.com`] }));
    }
  }
  const snapshot = async () =>
    (await db.query<{ from_id: string; to_id: string }>(`select from_id, to_id from enagram_links order by from_id, to_id`)).map(
      (r) => `${r.from_id}>${r.to_id}`,
    );

  await upsertDocuments(db, docs);
  assert.equal(await rebuildLinks(db, "me@x.com"), 200);
  const first = await snapshot();

  await db.query(`delete from enagram_documents`); // cascades to links
  await upsertDocuments(db, [...docs].reverse());
  assert.equal(await rebuildLinks(db, "me@x.com"), 200);
  const second = await snapshot();

  assert.equal(first.length, 200);
  assert.deepEqual(second, first);
});

test("buildLinkPairs links a participant in exactly 6 documents but not in 7", () => {
  const group = (n: number) =>
    Array.from({ length: n }, (_, i) => c(`${i % 2 ? "gmail" : "drive"}:${i}`, i % 2 ? "gmail" : "drive", ["list@x.com"]));
  assert.equal(buildLinkPairs(group(6), "me@x.com").length, 9); // 3 drive x 3 gmail
  assert.deepEqual(buildLinkPairs(group(7), "me@x.com"), []);
});

test("buildLinkPairs counts a document once per participant even if listed twice", () => {
  const pairs = buildLinkPairs(
    [c("gmail:1", "gmail", ["A@x.com", "a@x.com", " a@x.com"]), c("drive:1", "drive", ["a@x.com"])],
    "me@x.com",
  );
  assert.deepEqual(pairs, [{ from: "gmail:1", to: "drive:1" }]);
});

test("replaceLinks with no pairs clears every existing link", async () => {
  const db = await createTestDb();
  await applySchema(db);
  await upsertDocuments(db, [makeDoc({ id: "gmail:1" }), makeDoc({ id: "drive:1", source: "drive" })]);
  await replaceLinks(db, [{ from: "gmail:1", to: "drive:1" }]);
  assert.equal((await relatedTo(db, "gmail:1")).count, 1);
  await replaceLinks(db, []);
  assert.equal((await relatedTo(db, "gmail:1")).count, 0);
});

test("relatedTo returns the 10 most recent related documents, newest first, undated last", async () => {
  const db = await createTestDb();
  await applySchema(db);
  const docs = [makeDoc({ id: "gmail:hub" })];
  for (let i = 0; i < 12; i++) {
    docs.push(
      makeDoc({
        id: `drive:${String(i).padStart(2, "0")}`,
        source: "drive",
        docDate: i < 11 ? `2026-10-${String(i + 1).padStart(2, "0")}T00:00:00.000Z` : null,
      }),
    );
  }
  await upsertDocuments(db, docs);
  await replaceLinks(db, docs.slice(1).map((d) => ({ from: "gmail:hub", to: d.id })));
  const related = await relatedTo(db, "gmail:hub");
  assert.equal(related.count, 10);
  assert.deepEqual(
    related.results.map((r) => r.slug),
    ["drive:10", "drive:09", "drive:08", "drive:07", "drive:06", "drive:05", "drive:04", "drive:03", "drive:02", "drive:01"],
  );
});
