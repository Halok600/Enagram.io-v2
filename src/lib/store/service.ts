import { createEmbedder, type Embedder } from "../embeddings.ts";
import { createBrain, type Brain } from "./brain.ts";
import type { Db } from "./db.ts";
import { lazyAsync } from "./lazy.ts";
import { createPostgresDb } from "./pg.ts";
import { applySchema } from "./schema.ts";

let embedder: Embedder | null = null;

/**
 * One connection pool per serverless instance; the schema is created on first
 * use, so no manual SQL is ever needed. A failure is not cached (see lazyAsync),
 * so a database that was paused and then restored recovers on the next request.
 */
export const getDb = lazyAsync(async (): Promise<Db> => {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Missing required env var DATABASE_URL");
  const db = createPostgresDb(url);
  await applySchema(db);
  return db;
});

export function getEmbedder(): Embedder {
  embedder ??= createEmbedder();
  return embedder;
}

export async function getBrain(): Promise<Brain> {
  return createBrain({ db: await getDb(), embedder: getEmbedder() });
}
