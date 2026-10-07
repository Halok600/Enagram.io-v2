import { PGlite } from "@electric-sql/pglite";
import { vector } from "@electric-sql/pglite-pgvector";
import type { Db, Row } from "./db.ts";
import { EMBEDDING_DIMENSIONS } from "./schema.ts";
import type { StoredDocument } from "./types.ts";

type Queryable = { query: PGlite["query"] };

function wrapTransaction(tx: Queryable): Db {
  const self: Db = {
    query: async <T extends Row = Row>(text: string, params: unknown[] = []) =>
      (await tx.query<T>(text, params)).rows,
    transaction: async <T>(fn: (inner: Db) => Promise<T>) => fn(self),
  };
  return self;
}

/** A fresh, isolated, in-memory Postgres with pgvector. Tests only. */
export async function createTestDb(): Promise<Db> {
  const pg = new PGlite({ extensions: { vector } });
  await pg.exec("create extension if not exists vector;");
  return {
    query: async <T extends Row = Row>(text: string, params: unknown[] = []) =>
      (await pg.query<T>(text, params)).rows,
    transaction: async <T>(fn: (tx: Db) => Promise<T>) => pg.transaction((tx) => fn(wrapTransaction(tx))),
  };
}

export function unitVector(index: number): number[] {
  const values = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  values[index] = 1;
  return values;
}

export function makeDoc(overrides: Partial<StoredDocument> & { id: string }): StoredDocument {
  return {
    source: "gmail",
    title: "Title",
    body: "Body",
    url: null,
    docDate: null,
    participants: [],
    eventId: null,
    ...overrides,
  };
}

export async function setVector(db: Db, id: string, index: number): Promise<void> {
  await db.query(`update enagram_documents set embedding = $2::vector where id = $1`, [
    id,
    `[${unitVector(index).join(",")}]`,
  ]);
}
