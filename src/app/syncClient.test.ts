import { test } from "node:test";
import assert from "node:assert/strict";
import { runFullSync, type SyncProgress } from "./syncClient.ts";

function progress(extra: Partial<SyncProgress>): SyncProgress {
  return { phase: "fetch", counts: null, documents: 0, changed: 0, embedded: 0, remaining: 0, ...extra };
}

function scriptedFetch(responses: { ok?: boolean; body: unknown }[]) {
  const bodies: unknown[] = [];
  let i = 0;
  const fetchFn = (async (_url: unknown, init?: RequestInit) => {
    bodies.push(JSON.parse(String(init?.body)));
    const r = responses[i++];
    return { ok: r.ok ?? true, json: async () => r.body } as Response;
  }) as typeof fetch;
  return { fetchFn, bodies };
}

test("a sync with nothing to embed makes exactly one request", async () => {
  const { fetchFn, bodies } = scriptedFetch([
    { body: progress({ counts: { gmail: 2, drive: 1, calendar: 0 }, documents: 3, changed: 3, remaining: 0 }) },
  ]);
  const result = await runFullSync({ fetchFn });
  assert.deepEqual(bodies, [{ phase: "fetch", auto: false }]);
  assert.equal(result.documents, 3);
  assert.equal(result.stalled, false);
});

test("it keeps requesting the embed phase until nothing remains, summing the work", async () => {
  const { fetchFn, bodies } = scriptedFetch([
    { body: progress({ documents: 60, changed: 60, remaining: 60 }) },
    { body: progress({ phase: "embed", documents: 60, embedded: 40, remaining: 20 }) },
    { body: progress({ phase: "embed", documents: 60, embedded: 20, remaining: 0 }) },
  ]);
  const seen: number[] = [];
  const result = await runFullSync({ fetchFn, onProgress: (p) => seen.push(p.remaining) });
  assert.deepEqual(bodies, [{ phase: "fetch", auto: false }, { phase: "embed" }, { phase: "embed" }]);
  assert.equal(result.embedded, 60);
  assert.equal(result.remaining, 0);
  assert.deepEqual(seen, [60, 20, 0]);
});

test("it stops and reports a stall when an embed round makes no progress", async () => {
  const { fetchFn, bodies } = scriptedFetch([
    { body: progress({ documents: 10, remaining: 10 }) },
    { body: progress({ phase: "embed", documents: 10, embedded: 0, remaining: 10 }) },
  ]);
  const result = await runFullSync({ fetchFn });
  assert.equal(bodies.length, 2);
  assert.equal(result.stalled, true);
  assert.equal(result.remaining, 10);
});

test("a skipped auto-sync still finishes any embedding left over from an earlier sync", async () => {
  const { fetchFn, bodies } = scriptedFetch([
    { body: progress({ skipped: true, documents: 8, remaining: 3 }) },
    { body: progress({ phase: "embed", documents: 8, embedded: 3, remaining: 0 }) },
  ]);
  const result = await runFullSync({ auto: true, fetchFn });
  assert.deepEqual(bodies[0], { phase: "fetch", auto: true });
  assert.equal(result.skipped, true);
  assert.equal(result.embedded, 3);
});

test("a failing request throws the server's message", async () => {
  const { fetchFn } = scriptedFetch([{ ok: false, body: { error: "The database looks paused." } }]);
  await assert.rejects(runFullSync({ fetchFn }), /database looks paused/);
});

test("it never loops forever", async () => {
  const responses = [{ body: progress({ documents: 5, remaining: 5 }) }];
  for (let i = 0; i < 10; i++) responses.push({ body: progress({ phase: "embed", documents: 5, embedded: 1, remaining: 5 }) });
  const { fetchFn, bodies } = scriptedFetch(responses);
  const result = await runFullSync({ fetchFn, maxRounds: 3 });
  assert.equal(bodies.length, 4); // 1 fetch + 3 embed rounds
  assert.equal(result.stalled, true, "rounds ran out while work was still left, so indexing is incomplete");
  assert.equal(result.remaining, 5);
});

test("finishing exactly as the last round ends is not a stall", async () => {
  const { fetchFn } = scriptedFetch([
    { body: progress({ documents: 5, remaining: 5 }) },
    { body: progress({ phase: "embed", documents: 5, embedded: 5, remaining: 0 }) },
  ]);
  const result = await runFullSync({ fetchFn, maxRounds: 1 });
  assert.equal(result.stalled, false);
});
