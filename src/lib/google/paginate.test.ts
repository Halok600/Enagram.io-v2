import { test } from "node:test";
import assert from "node:assert/strict";
import { collectPages, type Page } from "./paginate.ts";

function pages(count: number, lastHasMore = false) {
  const tokens: (string | undefined)[] = [];
  const fetchPage = async (token?: string): Promise<Page<number>> => {
    tokens.push(token);
    const n = tokens.length;
    return { items: [n], nextPageToken: n < count || lastHasMore ? `t${n}` : undefined };
  };
  return { fetchPage, tokens };
}

test("a single page is returned as complete", async () => {
  const { fetchPage, tokens } = pages(1);
  assert.deepEqual(await collectPages(fetchPage, 5), { items: [1], truncated: false });
  assert.deepEqual(tokens, [undefined]);
});

test("it follows page tokens until Google has no more", async () => {
  const { fetchPage, tokens } = pages(3);
  assert.deepEqual(await collectPages(fetchPage, 5), { items: [1, 2, 3], truncated: false });
  assert.deepEqual(tokens, [undefined, "t1", "t2"]);
});

test("exactly the cap with nothing left is complete, not truncated", async () => {
  const { fetchPage } = pages(5);
  assert.deepEqual(await collectPages(fetchPage, 5), { items: [1, 2, 3, 4, 5], truncated: false });
});

test("hitting the cap with more pages left is reported as truncated", async () => {
  const { fetchPage, tokens } = pages(5, true);
  const result = await collectPages(fetchPage, 5);
  assert.equal(result.truncated, true);
  assert.deepEqual(result.items, [1, 2, 3, 4, 5]);
  assert.equal(tokens.length, 5, "stops at the cap instead of looping");
});

test("a failing page rejects rather than returning the pages read so far", async () => {
  let call = 0;
  await assert.rejects(
    collectPages(async () => {
      if (++call === 2) throw new Error("quota");
      return { items: [call], nextPageToken: "more" };
    }, 5),
    /quota/,
  );
});
