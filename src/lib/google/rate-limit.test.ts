import { test } from "node:test";
import assert from "node:assert/strict";
import { isRetryableGoogleError, mapWithConcurrency, withBackoff } from "./rate-limit.ts";

const quotaError = (extra: Record<string, unknown> = {}) =>
  Object.assign(
    new Error("Quota exceeded for quota metric 'Total Query Cost' of service 'gmail.googleapis.com'"),
    { code: 429, ...extra },
  );

test("isRetryableGoogleError: 429 and 503 are retryable", () => {
  assert.equal(isRetryableGoogleError({ code: 429 }), true);
  assert.equal(isRetryableGoogleError({ response: { status: 503 } }), true);
});

test("isRetryableGoogleError: 403 is retryable only when it is a rate-limit 403", () => {
  assert.equal(isRetryableGoogleError({ code: 403, errors: [{ reason: "userRateLimitExceeded" }] }), true);
  assert.equal(isRetryableGoogleError({ code: 403, errors: [{ reason: "rateLimitExceeded" }] }), true);
  assert.equal(isRetryableGoogleError({ code: 403, message: "Quota exceeded for quota metric" }), true);
  // A genuine permission 403 must NOT be retried — friendly-error.ts relies on seeing it.
  assert.equal(isRetryableGoogleError({ code: 403, errors: [{ reason: "insufficientPermissions" }] }), false);
});

test("isRetryableGoogleError: other failures are not retryable", () => {
  assert.equal(isRetryableGoogleError({ code: 404 }), false);
  assert.equal(isRetryableGoogleError(new Error("boom")), false);
  assert.equal(isRetryableGoogleError(undefined), false);
});

test("withBackoff returns the value after transient failures, with exponential delays", async () => {
  const delays: number[] = [];
  let calls = 0;
  const result = await withBackoff(
    async () => {
      calls++;
      if (calls < 4) throw quotaError();
      return "ok";
    },
    { retries: 3, baseMs: 100, random: () => 0, sleep: async (ms) => void delays.push(ms) },
  );
  assert.equal(result, "ok");
  assert.equal(calls, 4);
  assert.deepEqual(delays, [100, 200, 400]);
});

test("withBackoff gives up after the retry budget and rethrows the last error", async () => {
  let calls = 0;
  const err = quotaError();
  await assert.rejects(
    withBackoff(
      async () => {
        calls++;
        throw err;
      },
      { retries: 2, baseMs: 1, random: () => 0, sleep: async () => {} },
    ),
    (thrown) => thrown === err,
  );
  assert.equal(calls, 3);
});

test("withBackoff does not retry non-retryable errors", async () => {
  let calls = 0;
  let slept = false;
  await assert.rejects(
    withBackoff(
      async () => {
        calls++;
        throw Object.assign(new Error("nope"), { code: 404 });
      },
      { retries: 3, baseMs: 1, sleep: async () => void (slept = true) },
    ),
    /nope/,
  );
  assert.equal(calls, 1);
  assert.equal(slept, false);
});

test("withBackoff honors a Retry-After header (seconds)", async () => {
  const delays: number[] = [];
  let calls = 0;
  await withBackoff(
    async () => {
      calls++;
      if (calls === 1) throw quotaError({ response: { status: 429, headers: { "retry-after": "2" } } });
      return "ok";
    },
    { retries: 1, baseMs: 100, random: () => 0, sleep: async (ms) => void delays.push(ms) },
  );
  assert.deepEqual(delays, [2000]);
});

test("mapWithConcurrency preserves input order", async () => {
  const out = await mapWithConcurrency([30, 5, 20, 1], 2, async (n) => {
    await new Promise((r) => setTimeout(r, n));
    return n * 2;
  });
  assert.deepEqual(out, [60, 10, 40, 2]);
});

test("mapWithConcurrency never exceeds the concurrency limit", async () => {
  let inFlight = 0;
  let peak = 0;
  await mapWithConcurrency(Array.from({ length: 25 }, (_, i) => i), 4, async () => {
    inFlight++;
    peak = Math.max(peak, inFlight);
    await new Promise((r) => setTimeout(r, 2));
    inFlight--;
  });
  assert.equal(peak, 4);
});

test("mapWithConcurrency handles empty input and propagates failures", async () => {
  assert.deepEqual(await mapWithConcurrency([], 3, async (x) => x), []);
  await assert.rejects(
    mapWithConcurrency([1, 2, 3], 2, async (n) => {
      if (n === 2) throw new Error("bad item");
      return n;
    }),
    /bad item/,
  );
});
