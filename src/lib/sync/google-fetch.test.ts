import { test } from "node:test";
import assert from "node:assert/strict";
import { createTestDb } from "../store/test-db.ts";
import { applySchema } from "../store/schema.ts";
import { getMeta } from "../store/meta.ts";
import { upsertDocuments } from "../store/documents.ts";
import { toStoredDocument } from "./to-stored.ts";
import { runFetchPhase, type SyncDeps } from "./engine.ts";
import { GoogleFetchError, syncErrorMessage } from "./errors.ts";
import { guardGoogleFetch } from "./google-fetch.ts";

test("a slow Google fetch rejects as a GoogleFetchError and the fetch phase deletes nothing", async () => {
  const db = await createTestDb();
  await applySchema(db);
  await upsertDocuments(db, [
    toStoredDocument({
      id: "calendar:keep",
      source: "calendar",
      title: "Keep me",
      body: "",
      participants: [],
      attachments: [],
      timestamp: "2026-10-01T00:00:00Z",
      raw: { id: "keep" },
    }),
  ]);
  const deps: SyncDeps = {
    db,
    ownEmail: "me@x.com",
    now: () => 9999,
    embedDocuments: async () => [],
    fetchDocuments: async () => {
      const [calendar] = await guardGoogleFetch(
        () => Promise.all([new Promise<never[]>((resolve) => setTimeout(() => resolve([]), 500))]),
        20,
      );
      return { gmail: [], drive: [], calendar }; // would be an empty window if the guard let it through
    },
  };
  const started = Date.now();
  await assert.rejects(runFetchPhase(deps), (err: unknown) => {
    assert.ok(err instanceof GoogleFetchError);
    assert.match(syncErrorMessage(err), /Google fetch took longer than 20ms/);
    return true;
  });
  assert.ok(Date.now() - started < 400, "did not wait for the slow call");
  const rows = await db.query<{ id: string }>(`select id from enagram_documents`);
  assert.deepEqual(rows.map((r) => r.id), ["calendar:keep"]);
  assert.equal(await getMeta(db, "last_synced_at"), null);
});

test("a rejecting Google call is tagged as a GoogleFetchError; a fast success passes through", async () => {
  await assert.rejects(guardGoogleFetch(() => Promise.reject(new Error("401 invalid_grant")), 50), GoogleFetchError);
  assert.deepEqual(await guardGoogleFetch(() => Promise.resolve([1, 2]), 50), [1, 2]);
});
