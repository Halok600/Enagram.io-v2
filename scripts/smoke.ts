import { createPostgresDb } from "../src/lib/store/pg.ts";
import { applySchema } from "../src/lib/store/schema.ts";
import { upsertDocuments } from "../src/lib/store/documents.ts";
import { searchDocuments } from "../src/lib/store/search.ts";

// Manual live check against the real database: `npm run smoke` (needs DATABASE_URL in .env.local).
// Writes one throwaway document and removes it again. The body holds a unique token, and the
// search is for exactly that token, so leftover real documents cannot make the check pass.
// DATABASE_URL can also come from the environment: `DATABASE_URL=... npm run smoke`.
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL (for example in .env.local) first.");
  process.exit(1);
}

const db = createPostgresDb(url);
const id = "gmail:enagram_smoke_1";
const token = "enagramsmoke7f3a";
let exitCode = 0;

try {
  await applySchema(db);
  console.log("schema ok");

  await upsertDocuments(db, [
    {
      id,
      source: "gmail",
      title: "Smoke test document",
      body: `smoke test body ${token}`,
      url: null,
      docDate: null,
      participants: [],
      eventId: null,
    },
  ]);
  const hits = await searchDocuments(db, { query: token });
  if (!hits.some((hit) => hit.slug === id)) throw new Error(`the smoke document was not found by keyword search for "${token}"`);
  console.log("upsert + keyword search ok");
} catch (err) {
  console.error("smoke test FAILED", err);
  exitCode = 1;
} finally {
  try {
    await db.query("delete from enagram_documents where id = $1::text", [id]);
    console.log("cleaned up");
  } catch (err) {
    console.error("cleanup failed", err);
  }
  process.exit(exitCode); // the connection pool would otherwise keep the process alive
}
