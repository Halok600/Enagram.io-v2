import { test } from "node:test";
import assert from "node:assert/strict";
import { extractEach } from "./extract-each.ts";

/** Runs `fn` with console.error muted, so expected failure logs do not pollute the test output. */
async function quietly<T>(fn: () => Promise<T>): Promise<{ result: T; logged: unknown[][] }> {
  const original = console.error;
  const logged: unknown[][] = [];
  console.error = (...args) => void logged.push(args);
  try {
    return { result: await fn(), logged };
  } finally {
    console.error = original;
  }
}

const f = (id: string) => ({ id });

test("files whose content extracts are returned with it, in order", async () => {
  const { result } = await quietly(() => extractEach([f("a"), f("b")], async (x) => `text of ${x.id}`, 50));
  assert.deepEqual(result.extracted, [
    { file: f("a"), content: "text of a" },
    { file: f("b"), content: "text of b" },
  ]);
  assert.equal(result.skipped, 0);
});

test("a file whose extraction throws is skipped, never returned with an empty body", async () => {
  const { result, logged } = await quietly(() =>
    extractEach(
      [f("good"), f("bad"), f("also-good")],
      async (x) => {
        if (x.id === "bad") throw new Error("pdf parse failed");
        return `text of ${x.id}`;
      },
      50,
    ),
  );
  assert.deepEqual(result.extracted.map((e) => e.file.id), ["good", "also-good"]);
  assert.equal(result.skipped, 1);
  assert.equal(logged.length, 1, "the skip is logged");
});

test("a download that hangs past the timeout is skipped without holding up the rest", async () => {
  const started = Date.now();
  const { result } = await quietly(() =>
    extractEach(
      [f("slow"), f("fast")],
      (x) => (x.id === "slow" ? new Promise<string>((resolve) => setTimeout(() => resolve("late"), 500)) : Promise.resolve("ok")),
      20,
    ),
  );
  assert.ok(Date.now() - started < 400);
  assert.deepEqual(result.extracted, [{ file: f("fast"), content: "ok" }]);
  assert.equal(result.skipped, 1);
});

test("an empty body from a type we do not extract is kept (metadata-only), not skipped", async () => {
  const { result } = await quietly(() => extractEach([f("img")], async () => "", 50));
  assert.deepEqual(result.extracted, [{ file: f("img"), content: "" }]);
  assert.equal(result.skipped, 0);
});
