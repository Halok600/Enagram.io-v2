import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMBED_ROUND_WAIT_MS,
  MAX_RATE_LIMITED_ROUNDS,
  RATE_LIMITED_WAIT_MS,
  runFullSync,
  syncStopMessage,
  waitingMessage,
  type FullSyncResult,
  type SyncProgress,
} from "./syncClient.ts";

function progress(extra: Partial<SyncProgress>): SyncProgress {
  return { phase: "fetch", counts: null, documents: 0, changed: 0, embedded: 0, remaining: 0, ...extra };
}

/** Existing tests must not really wait between rounds. */
const noSleep = async () => {};

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
  const result = await runFullSync({ fetchFn, sleep: noSleep, onProgress: (p) => seen.push(p.remaining) });
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
  const result = await runFullSync({ auto: true, fetchFn, sleep: noSleep });
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
  const result = await runFullSync({ fetchFn, maxRounds: 3, sleep: noSleep });
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

test("a non-JSON gateway error (Vercel's HTML 504) becomes a plain message, not a parse error", async () => {
  const fetchFn = (async () =>
    ({
      ok: false,
      status: 504,
      statusText: "Gateway Timeout",
      json: async () => {
        throw new SyntaxError("Unexpected token 'A', \"An error o\"... is not valid JSON");
      },
    }) as unknown as Response) as typeof fetch;
  await assert.rejects(runFullSync({ fetchFn }), (err: Error) => {
    assert.match(err.message, /server stopped answering \(504\)/);
    assert.doesNotMatch(err.message, /Unexpected token/);
    return true;
  });
});

test("a non-JSON success body is reported instead of crashing", async () => {
  const fetchFn = (async () =>
    ({ ok: true, status: 200, statusText: "OK", json: async () => { throw new SyntaxError("bad"); } }) as unknown as Response) as typeof fetch;
  await assert.rejects(runFullSync({ fetchFn }), /unexpected response/i);
});

function recordingSleep() {
  const waits: number[] = [];
  const sleep = async (ms: number) => void waits.push(ms);
  return { sleep, waits };
}

test("it waits 40s between embed rounds that made normal progress, and not after the last one", async () => {
  const { fetchFn } = scriptedFetch([
    { body: progress({ documents: 30, remaining: 30 }) },
    { body: progress({ phase: "embed", documents: 30, embedded: 10, remaining: 20 }) },
    { body: progress({ phase: "embed", documents: 30, embedded: 10, remaining: 10 }) },
    { body: progress({ phase: "embed", documents: 30, embedded: 10, remaining: 0 }) },
  ]);
  const { sleep, waits } = recordingSleep();
  const result = await runFullSync({ fetchFn, sleep });
  assert.deepEqual(waits, [40_000, 40_000]);
  assert.equal(EMBED_ROUND_WAIT_MS, 40_000);
  assert.equal(result.remaining, 0);
  assert.equal(result.rateLimited, false);
});

test("it waits 60s after a rate-limited round, even one that embedded something, then carries on", async () => {
  const { fetchFn } = scriptedFetch([
    { body: progress({ documents: 30, remaining: 30 }) },
    { body: progress({ phase: "embed", documents: 30, embedded: 0, remaining: 30, rateLimited: true }) },
    { body: progress({ phase: "embed", documents: 30, embedded: 8, remaining: 22, rateLimited: true }) },
    { body: progress({ phase: "embed", documents: 30, embedded: 22, remaining: 0 }) },
  ]);
  const { sleep, waits } = recordingSleep();
  const result = await runFullSync({ fetchFn, sleep });
  assert.deepEqual(waits, [60_000, 60_000]);
  assert.equal(RATE_LIMITED_WAIT_MS, 60_000);
  assert.equal(result.embedded, 30);
  assert.equal(result.remaining, 0);
  assert.equal(result.rateLimited, false);
  assert.equal(result.stalled, false);
});

test("it stops after 3 rate-limited rounds in a row and says so", async () => {
  const limited = { body: progress({ phase: "embed", documents: 30, embedded: 0, remaining: 30, rateLimited: true }) };
  const { fetchFn, bodies } = scriptedFetch([{ body: progress({ documents: 30, remaining: 30 }) }, limited, limited, limited, limited]);
  const { sleep, waits } = recordingSleep();
  const result = await runFullSync({ fetchFn, sleep });
  assert.equal(MAX_RATE_LIMITED_ROUNDS, 3);
  assert.equal(bodies.length, 4, "1 fetch + 3 embed rounds");
  assert.deepEqual(waits, [60_000, 60_000], "no pointless wait after the final attempt");
  assert.equal(result.rateLimited, true);
  assert.equal(result.stalled, true);
  assert.equal(result.remaining, 30);
});

test("a round that is not rate-limited resets the rate-limit streak", async () => {
  const limited = { body: progress({ phase: "embed", documents: 30, embedded: 0, remaining: 30, rateLimited: true }) };
  const ok = { body: progress({ phase: "embed", documents: 30, embedded: 1, remaining: 30 }) };
  const { fetchFn } = scriptedFetch([
    { body: progress({ documents: 30, remaining: 30 }) },
    limited, limited, ok, limited, limited,
    { body: progress({ phase: "embed", documents: 30, embedded: 30, remaining: 0 }) },
  ]);
  const { sleep } = recordingSleep();
  const result = await runFullSync({ fetchFn, sleep });
  assert.equal(result.rateLimited, false);
  assert.equal(result.remaining, 0);
});

test("auto mode runs at most one embed round and never waits", async () => {
  const { fetchFn, bodies } = scriptedFetch([
    { body: progress({ documents: 30, remaining: 30 }) },
    { body: progress({ phase: "embed", documents: 30, embedded: 8, remaining: 22 }) },
    { body: progress({ phase: "embed", documents: 30, embedded: 8, remaining: 14 }) },
  ]);
  const { sleep, waits } = recordingSleep();
  const result = await runFullSync({ auto: true, fetchFn, sleep });
  assert.equal(bodies.length, 2, "one fetch and one embed round");
  assert.deepEqual(waits, []);
  assert.equal(result.remaining, 22);
  assert.equal(result.stalled, true);
});

test("onWait reports each wait and clears it afterwards", async () => {
  const { fetchFn } = scriptedFetch([
    { body: progress({ documents: 20, remaining: 20 }) },
    { body: progress({ phase: "embed", documents: 20, embedded: 10, remaining: 10 }) },
    { body: progress({ phase: "embed", documents: 20, embedded: 10, remaining: 0 }) },
  ]);
  const events: unknown[] = [];
  await runFullSync({ fetchFn, sleep: async () => {}, onWait: (w) => events.push(w) });
  assert.deepEqual(events, [{ seconds: 40, remaining: 10 }, null]);
});

test("the waiting and stop messages explain the free-tier pause and the quota stop", () => {
  assert.equal(
    waitingMessage({ seconds: 40, remaining: 12 }),
    "Waiting 40s so Gemini's free-tier limit can recover (12 document(s) left)...",
  );
  const base: FullSyncResult = { counts: null, documents: 9, changed: 0, embedded: 0, remaining: 7, skipped: false, stalled: true, rateLimited: true };
  assert.match(syncStopMessage(base) ?? "", /Gemini's embedding limit was reached \(free tier\)\. 7 document\(s\) are not indexed for search by meaning yet; keyword search already works\. Try again in a few minutes, or turn on billing/);
  assert.match(syncStopMessage({ ...base, rateLimited: false }) ?? "", /Search by meaning is still catching up/);
  assert.equal(syncStopMessage({ ...base, stalled: false, rateLimited: false, remaining: 0 }), null);
});
