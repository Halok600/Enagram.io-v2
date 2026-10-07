import { test } from "node:test";
import assert from "node:assert/strict";
import { MockEmbeddingModelV4 } from "ai/test";
import { createEmbedder } from "./embeddings.ts";

type GoogleOptions = { google: { taskType: string; outputDimensionality: number } };

function fakeModel() {
  return new MockEmbeddingModelV4({
    maxEmbeddingsPerCall: 100,
    doEmbed: async ({ values }) => ({
      embeddings: values.map((v) => [v.length, 0]),
      usage: { tokens: 1 },
      warnings: [],
    }),
  });
}

test("documents() keeps input order and asks for 768-dimension document embeddings", async () => {
  const model = fakeModel();
  const out = await createEmbedder(model).documents(["a", "bbb"]);
  assert.deepEqual(out, [[1, 0], [3, 0]]);
  assert.equal(model.doEmbedCalls.length, 1);
  const options = model.doEmbedCalls[0].providerOptions as GoogleOptions;
  assert.equal(options.google.taskType, "RETRIEVAL_DOCUMENT");
  assert.equal(options.google.outputDimensionality, 768);
});

test("documents([]) does not call the model", async () => {
  const model = fakeModel();
  assert.deepEqual(await createEmbedder(model).documents([]), []);
  assert.equal(model.doEmbedCalls.length, 0);
});

test("query() uses the query task type", async () => {
  const model = fakeModel();
  const vector = await createEmbedder(model).query("hello");
  assert.deepEqual(vector, [5, 0]);
  const options = model.doEmbedCalls[0].providerOptions as GoogleOptions;
  assert.equal(options.google.taskType, "RETRIEVAL_QUERY");
  assert.equal(options.google.outputDimensionality, 768);
});
