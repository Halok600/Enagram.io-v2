import { test } from "node:test";
import assert from "node:assert/strict";
import { lazyAsync } from "./lazy.ts";

test("concurrent calls share one in-flight factory call", async () => {
  let calls = 0;
  const get = lazyAsync(async () => {
    calls += 1;
    return { value: 42 };
  });
  const [a, b] = await Promise.all([get(), get()]);
  assert.equal(calls, 1);
  assert.equal(a, b);
  assert.equal(a.value, 42);
});

test("a success is cached across later calls", async () => {
  let calls = 0;
  const get = lazyAsync(async () => {
    calls += 1;
    return calls;
  });
  assert.equal(await get(), 1);
  assert.equal(await get(), 1);
  assert.equal(await get(), 1);
  assert.equal(calls, 1);
});

test("a rejection is not cached: the next call retries the factory", async () => {
  let calls = 0;
  const get = lazyAsync(async () => {
    calls += 1;
    if (calls === 1) throw new Error("database paused");
    return "restored";
  });
  await assert.rejects(get(), /database paused/);
  assert.equal(await get(), "restored");
  assert.equal(calls, 2);
});

test("a factory that throws synchronously rejects instead of throwing, and is retried", async () => {
  let calls = 0;
  const get = lazyAsync<string>(() => {
    calls += 1;
    if (calls === 1) throw new Error("sync failure");
    return Promise.resolve("ok");
  });
  let promise: Promise<string> | undefined;
  assert.doesNotThrow(() => {
    promise = get();
  });
  await assert.rejects(promise!, /sync failure/);
  assert.equal(await get(), "ok");
  assert.equal(calls, 2);
});
