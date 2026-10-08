import { test } from "node:test";
import assert from "node:assert/strict";
import type { BrainDocument } from "../brain/types.ts";
import { createTestDb, makeDoc, unitVector } from "../store/test-db.ts";
import { applySchema } from "../store/schema.ts";
import type { Db } from "../store/db.ts";
import { countDocuments, countPending, upsertDocuments } from "../store/documents.ts";
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
      gmail: [bd("gmail:1", "gmail", { participants: ["priya@x.com", "me@x.com"] })],
      drive: [],
      calendar: [bd("calendar:a", "calendar", { participants: ["priya@x.com"] })],
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
      gmail: [bd("gmail:1", "gmail", { participants: ["priya@x.com", "me@x.com"] })],
      drive: [],
      calendar: [bd("calendar:a", "calendar", { participants: ["priya@x.com"] })],
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

/** Runs `fn` with console.error muted, so expected failure logs do not pollute the test output. */
async function quietly<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = original;
  }
}

const stored = (db: Db) =>
  db.query<{ id: string }>(`select id from enagram_documents order by id`).then((rows) => rows.map((r) => r.id));

test("a throwing fetch leaves stored data and the last-sync time untouched", async () => {
  const { db, deps } = await setup({ current: gmailOnly(2) }, { now: () => 1000 });
  await runFetchPhase(deps);
  const failing: SyncDeps = {
    ...deps,
    now: () => 9999,
    fetchDocuments: async () => {
      throw new Error("google down");
    },
  };
  await assert.rejects(runFetchPhase(failing), /google down/);
  assert.deepEqual(await stored(db), ["gmail:0", "gmail:1"]);
  assert.equal(await getMeta(db, "last_synced_at"), "1000");
});

test("a participants-only change relinks the documents", async () => {
  const fetched = {
    current: {
      gmail: [bd("gmail:1", "gmail", { participants: ["a@x.com"] })],
      drive: [],
      calendar: [bd("calendar:a", "calendar", { participants: ["b@x.com"] })],
    },
  };
  const { db, deps } = await setup(fetched);
  await runFetchPhase(deps);
  assert.equal((await relatedTo(db, "gmail:1")).count, 0);

  fetched.current = {
    ...fetched.current,
    calendar: [bd("calendar:a", "calendar", { participants: ["b@x.com", "a@x.com"] })], // only participants differ
  };
  const again = await runFetchPhase(deps);
  assert.equal(again.changed, 1);
  assert.deepEqual((await relatedTo(db, "gmail:1")).results.map((r) => r.slug), ["calendar:a"]);
});

test("deleting a calendar document in Google also removes its links", async () => {
  const fetched = {
    current: {
      gmail: [bd("gmail:1", "gmail", { participants: ["a@x.com"] })],
      drive: [],
      calendar: [bd("calendar:a", "calendar", { participants: ["a@x.com"] })],
    },
  };
  const { db, deps } = await setup(fetched);
  await runFetchPhase(deps);
  assert.equal((await relatedTo(db, "gmail:1")).count, 1);

  fetched.current = { ...fetched.current, calendar: [] };
  await runFetchPhase(deps);
  assert.equal((await relatedTo(db, "gmail:1")).count, 0);
  const [{ n }] = await db.query<{ n: number }>(`select count(*)::int as n from enagram_links`);
  assert.equal(n, 0);
});

test("an embedder returning fewer vectors than requested stops cleanly and writes nothing", async () => {
  await quietly(async () => {
    const { deps } = await setup(
      { current: gmailOnly(3) },
      { embedDocuments: async (texts) => texts.slice(1).map(() => unitVector(0)) },
    );
    await runFetchPhase(deps);
    const progress = await runEmbedPhase(deps, 40_000, 3);
    assert.equal(progress.embedded, 0);
    assert.equal(progress.remaining, 3);
  });
});

test("a failure part-way through keeps the batches already embedded", async () => {
  await quietly(async () => {
    let calls = 0;
    const { deps } = await setup(
      { current: gmailOnly(5) },
      {
        embedDocuments: async (texts) => {
          if (++calls === 2) throw new Error("rate limited");
          return texts.map(() => unitVector(0));
        },
      },
    );
    await runFetchPhase(deps);
    const progress = await runEmbedPhase(deps, 40_000, 2);
    assert.equal(progress.embedded, 2);
    assert.equal(progress.remaining, 3);
  });
});

test("a malformed vector skips only that document; the rest of the batch is written", async () => {
  await quietly(async () => {
    const withValue = (index: number, value: number) => Object.assign(unitVector(0), { [index]: value });
    const malformed = [new Array<number>(10).fill(0), withValue(5, Number.NaN), withValue(5, Infinity)];
    let firstBatch = true;
    const { db, deps } = await setup(
      { current: gmailOnly(4) },
      {
        embedDocuments: async (texts) => {
          const vectors = texts.map((_, i) => (firstBatch && i < malformed.length ? malformed[i] : unitVector(0)));
          firstBatch = false;
          return vectors;
        },
      },
    );
    await runFetchPhase(deps);
    const progress = await runEmbedPhase(deps, 40_000, 4);
    // the first batch has three malformed vectors and one good one; the bad ones are skipped, not retried
    assert.equal(progress.embedded, 1);
    assert.equal(progress.remaining, 3);
    assert.equal(await countPending(db), 3);
  });
});

test("a database error while storing embeddings does not escape the embed phase", async () => {
  await quietly(async () => {
    const { db, deps } = await setup({ current: gmailOnly(3) });
    await runFetchPhase(deps);
    const failingWrites: Db = {
      query: async (text, params) => {
        if (text.includes("set embedding")) throw new Error("invalid input syntax for type vector");
        return db.query(text, params);
      },
      transaction: (fn) => db.transaction(fn),
    };
    const progress = await runEmbedPhase({ ...deps, db: failingWrites }, 40_000, 2);
    assert.equal(progress.embedded, 0);
    assert.equal(progress.remaining, 3);
  });
});

test("embedded counts only rows actually written (a document edited mid-embed is not counted)", async () => {
  const later: { db?: Db } = {};
  let clock = 0; // one batch exhausts the budget, so only that batch is attempted
  const { db, deps } = await setup(
    { current: gmailOnly(2) },
    {
      now: () => clock,
      embedDocuments: async (texts) => {
        // gmail:0 changes while its embedding is being computed
        await upsertDocuments(later.db!, [makeDoc({ id: "gmail:0", body: "edited meanwhile" })]);
        clock += 50_000;
        return texts.map(() => unitVector(0));
      },
    },
  );
  later.db = db;
  await runFetchPhase(deps);
  const progress = await runEmbedPhase(deps, 40_000, 2);
  assert.equal(progress.embedded, 1);
  assert.equal(progress.remaining, 1);
});

test("a slow embedding call is abandoned after its timeout; documents stay pending", async () => {
  await quietly(async () => {
    const { deps } = await setup(
      { current: gmailOnly(2) },
      { embedDocuments: () => new Promise<number[][]>((resolve) => setTimeout(() => resolve([]), 500)) },
    );
    await runFetchPhase(deps);
    const started = Date.now();
    const progress = await runEmbedPhase(deps, 40_000, 2, 30);
    assert.ok(Date.now() - started < 400, "returned without waiting for the slow call");
    assert.equal(progress.embedded, 0);
    assert.equal(progress.remaining, 2);
  });
});

test("the embed budget is measured from the request start, not from the start of the embed phase", async () => {
  let clock = 0;
  const { deps } = await setup(
    { current: gmailOnly(5) },
    {
      now: () => clock,
      embedDocuments: async (texts) => {
        clock += 5_000;
        return texts.map(() => unitVector(0));
      },
    },
  );
  await runFetchPhase(deps);
  // The request began 30s ago (cold start, auth, DB connect): only 10s of the 40s budget is left.
  const progress = await runEmbedPhase(deps, 40_000, 1, undefined, -30_000);
  assert.equal(progress.embedded, 2);
  assert.equal(progress.remaining, 3);
});

test("a truncated calendar list stores what it has but never deletes calendar rows", async () => {
  const fetched = {
    current: { gmail: [], drive: [], calendar: [bd("calendar:a", "calendar"), bd("calendar:b", "calendar")] } as FetchedDocuments,
  };
  const { db, deps } = await setup(fetched);
  await runFetchPhase(deps);
  // Same window, but the fetcher hit its page cap: calendar:b may simply be on a page we never read.
  fetched.current = { gmail: [], drive: [], calendar: [bd("calendar:a", "calendar")], calendarTruncated: true };
  const warn = console.warn;
  const warnings: unknown[][] = [];
  console.warn = (...args) => void warnings.push(args);
  try {
    await runFetchPhase(deps);
  } finally {
    console.warn = warn;
  }
  assert.equal(warnings.length, 1, "the skipped deletion is logged");
  assert.deepEqual(await stored(db), ["calendar:a", "calendar:b"]);
  // A later complete fetch resumes normal deletion.
  fetched.current = { gmail: [], drive: [], calendar: [bd("calendar:a", "calendar")] };
  await runFetchPhase(deps);
  assert.deepEqual(await stored(db), ["calendar:a"]);
});
