import { test } from "node:test";
import assert from "node:assert/strict";
import type { Db } from "./db.ts";
import { createTestDb, makeDoc, setVector, unitVector } from "./test-db.ts";
import { applySchema } from "./schema.ts";
import { upsertDocuments } from "./documents.ts";
import { replaceLinks } from "./links.ts";
import { createBrain } from "./brain.ts";

async function seeded() {
  const db = await createTestDb();
  await applySchema(db);
  await upsertDocuments(db, [
    makeDoc({ id: "gmail:1", title: "TCS selection update", body: "TCS talent acquisition status" }),
    makeDoc({ id: "gmail:2", title: "Unrelated newsletter", body: "nothing to see" }),
    makeDoc({ id: "drive:1", source: "drive", title: "TCS offer letter", body: "TCS offer" }),
    makeDoc({ id: "calendar:1", source: "calendar", title: "TCS interview", body: "TCS round", eventId: "e1" }),
  ]);
  return db;
}

const embedder = { query: async () => unitVector(0) };

const broken: Db = {
  query: () => Promise.reject(new Error("boom")),
  transaction: () => Promise.reject(new Error("boom")),
};

test("each search tool only returns its own source", async () => {
  const brain = createBrain({ db: await seeded(), embedder });
  assert.deepEqual((await brain.searchGmail("TCS")).map((h) => h.slug), ["gmail:1"]);
  assert.deepEqual((await brain.searchDrive("TCS")).map((h) => h.slug), ["drive:1"]);
  const calendar = await brain.searchCalendar("TCS");
  assert.deepEqual(calendar.map((h) => h.slug), ["calendar:1"]);
  assert.equal(calendar[0].eventId, "e1");
});

test("the query embedding is used: a semantic-only match is found", async () => {
  const db = await seeded();
  await setVector(db, "gmail:2", 0);
  const brain = createBrain({ db, embedder });
  const hits = await brain.searchGmail("zzzzqq");
  assert.deepEqual(hits.map((h) => h.slug), ["gmail:2"]);
});

test("if embedding the query fails, search still works by keyword", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    const brain = createBrain({
      db: await seeded(),
      embedder: { query: async () => Promise.reject(new Error("quota")) },
    });
    assert.deepEqual((await brain.searchGmail("TCS")).map((h) => h.slug), ["gmail:1"]);
  } finally {
    console.error = original;
  }
});

test("an unusable query vector (wrong length or non-finite) falls back to keyword search", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    for (const bad of [[0.1, 0.2, 0.3], unitVector(0).map(() => Number.NaN), []]) {
      const brain = createBrain({ db: await seeded(), embedder: { query: async () => bad } });
      assert.deepEqual((await brain.searchGmail("TCS")).map((h) => h.slug), ["gmail:1"]);
    }
  } finally {
    console.error = original;
  }
});

test("findRelated follows stored links", async () => {
  const db = await seeded();
  await replaceLinks(db, [{ from: "gmail:1", to: "drive:1" }]);
  const related = await createBrain({ db, embedder }).findRelated("gmail:1");
  assert.equal(related.count, 1);
  assert.equal(related.results[0].slug, "drive:1");
});

test("preferences can be saved, read and forgotten", async () => {
  const brain = createBrain({ db: await seeded(), embedder });
  assert.deepEqual(await brain.savePreference("User prefers concise answers"), { status: "saved" });
  assert.deepEqual(await brain.getPreferences(), ["User prefers concise answers"]);
  assert.deepEqual(await brain.forgetPreference("concise"), { status: "removed" });
  assert.deepEqual(await brain.getPreferences(), []);
});

test("reading preferences never throws and never hangs the chat", async () => {
  const original = console.error;
  console.error = () => {};
  try {
    assert.deepEqual(await createBrain({ db: broken, embedder }).getPreferences(), []);

    const hanging: Db = {
      query: () => new Promise<never>(() => {}),
      transaction: () => new Promise<never>(() => {}),
    };
    const slow = createBrain({ db: hanging, embedder }, { preferencesTimeoutMs: 20 });
    assert.deepEqual(await slow.getPreferences(), []);
  } finally {
    console.error = original;
  }
});

test("saving or forgetting with a failing database throws instead of overwriting anything", async () => {
  const brain = createBrain({ db: broken, embedder });
  await assert.rejects(brain.savePreference("x"), /boom/);
  await assert.rejects(brain.forgetPreference("x"), /boom/);
});
