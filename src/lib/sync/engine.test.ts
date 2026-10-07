import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrainDocument } from "../brain/types.ts";
import { createTestDb, unitVector } from "../store/test-db.ts";
import { applySchema } from "../store/schema.ts";
import { countDocuments } from "../store/documents.ts";
import { relatedTo, replaceLinks } from "../store/links.ts";
import { getMeta } from "../store/meta.ts";
import { runEmbedPhase, runFetchPhase, type FetchedDocuments, type SyncDeps } from "./engine.ts";

function bd(id: string, source: BrainDocument["source"], extra: Partial<BrainDocument> = {}): BrainDocument {
  return {
    id,
    source,
    title: `Title ${id}`,
    body: `Body ${id}`,
    participants: [],
    attachments: [],
    timestamp: "2026-10-01T00:00:00Z",
    raw: source === "calendar" ? { id: id.replace("calendar:", "") } : {},
    ...extra,
  };
}

async function setup(fetched: { current: FetchedDocuments }, overrides: Partial<SyncDeps> = {}) {
  const db = await createTestDb();
  await applySchema(db);
  const embedCalls: string[][] = [];
  const deps: SyncDeps = {
    db,
    ownEmail: "me@x.com",
    fetchDocuments: async () => fetched.current,
    embedDocuments: async (texts) => {
      embedCalls.push(texts);
      return texts.map(() => unitVector(0));
    },
    ...overrides,
  };
  return { db, deps, embedCalls };
}

const gmailOnly = (n: number): FetchedDocuments => ({
  gmail: Array.from({ length: n }, (_, i) => bd(`gmail:${i}`, "gmail")),
  drive: [],
  calendar: [],
});

test("the fetch phase stores documents, reports counts, and records the sync time", async () => {
  const fetched = { current: { gmail: [bd("gmail:1", "gmail")], drive: [], calendar: [bd("calendar:a", "calendar")] } };
  const { db, deps } = await setup(fetched, { now: () => 1234 });
  const progress = await runFetchPhase(deps);
  assert.equal(progress.phase, "fetch");
  assert.deepEqual(progress.counts, { gmail: 1, drive: 0, calendar: 1 });
  assert.equal(progress.documents, 2);
  assert.equal(progress.changed, 2);
  assert.equal(progress.remaining, 2);
  assert.equal(await getMeta(db, "last_synced_at"), "1234");
});

test("a calendar-only re-ingest does not touch the last-sync time", async () => {
  const { db, deps } = await setup({ current: gmailOnly(1) }, { touchLastSynced: false });
  await runFetchPhase(deps);
  assert.equal(await getMeta(db, "last_synced_at"), null);
});

test("a second identical fetch changes nothing and re-embeds nothing", async () => {
  const fetched = { current: gmailOnly(3) };
  const { deps, embedCalls } = await setup(fetched);
  await runFetchPhase(deps);
  await runEmbedPhase(deps);
  const again = await runFetchPhase(deps);
  assert.equal(again.changed, 0);
  assert.equal(again.remaining, 0);
  await runEmbedPhase(deps);
  assert.equal(embedCalls.length, 1, "the second embed phase had nothing to do");
});

test("documents sharing a participant across sources get linked", async () => {
  const fetched = {
    current: {
      gmail: [bd("gmail:1", "gmail", { participants: ["nirmit@x.com", "me@x.com"] })],
      drive: [],
      calendar: [bd("calendar:a", "calendar", { participants: ["nirmit@x.com"] })],
    },
  };
  const { db, deps } = await setup(fetched);
  await runFetchPhase(deps);
  const related = await relatedTo(db, "gmail:1");
  assert.deepEqual(related.results.map((r) => r.slug), ["calendar:a"]);
});

test("links are rebuilt on every fetch, so a lost or stale rebuild self-heals", async () => {
  const fetched = {
    current: {
      gmail: [bd("gmail:1", "gmail", { participants: ["nirmit@x.com", "me@x.com"] })],
      drive: [],
      calendar: [bd("calendar:a", "calendar", { participants: ["nirmit@x.com"] })],
    },
  };
  const { db, deps } = await setup(fetched);
  await runFetchPhase(deps);
  assert.deepEqual((await relatedTo(db, "gmail:1")).results.map((r) => r.slug), ["calendar:a"]);

  await replaceLinks(db, []); // simulate an overlapping sync committing an older link set
  assert.equal((await relatedTo(db, "gmail:1")).count, 0);

  const again = await runFetchPhase(deps);
  assert.equal(again.changed, 0, "the documents are unchanged");
  assert.deepEqual((await relatedTo(db, "gmail:1")).results.map((r) => r.slug), ["calendar:a"]);
});

test("a calendar event deleted in Google disappears; Gmail documents stay", async () => {
  const fetched = {
    current: { gmail: [bd("gmail:1", "gmail")], drive: [], calendar: [bd("calendar:a", "calendar"), bd("calendar:b", "calendar")] },
  };
  const { db, deps } = await setup(fetched);
  await runFetchPhase(deps);
  fetched.current = { gmail: [], drive: [], calendar: [bd("calendar:a", "calendar")] };
  await runFetchPhase(deps);
  const rows = await db.query<{ id: string }>(`select id from enagram_documents order by id`);
  assert.deepEqual(rows.map((r) => r.id), ["calendar:a", "gmail:1"]);
});

test("the embed phase embeds everything pending, in batches", async () => {
  const { db, deps, embedCalls } = await setup({ current: gmailOnly(5) });
  await runFetchPhase(deps);
  const progress = await runEmbedPhase(deps, 40_000, 2);
  assert.equal(progress.phase, "embed");
  assert.equal(progress.embedded, 5);
  assert.equal(progress.remaining, 0);
  assert.deepEqual(embedCalls.map((c) => c.length), [2, 2, 1]);
  assert.equal(await countDocuments(db), 5);
});

test("the embed phase stops when its time budget is spent and reports what is left", async () => {
  let clock = 0;
  const { deps } = await setup(
    { current: gmailOnly(5) },
    {
      now: () => clock,
      embedDocuments: async (texts) => {
        clock += 25_000; // each batch "takes" 25s
        return texts.map(() => unitVector(0));
      },
    },
  );
  await runFetchPhase(deps);
  const progress = await runEmbedPhase(deps, 40_000, 1);
  assert.equal(progress.embedded, 2);
  assert.equal(progress.remaining, 3);
});

test("an embedding failure never throws; documents stay pending for the next call", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const { deps } = await setup(
      { current: gmailOnly(3) },
      {
        embedDocuments: async () => {
          throw new Error("rate limited");
        },
      },
    );
    await runFetchPhase(deps);
    const progress = await runEmbedPhase(deps);
    assert.equal(progress.embedded, 0);
    assert.equal(progress.remaining, 3);
  } finally {
    console.error = original;
  }
});
