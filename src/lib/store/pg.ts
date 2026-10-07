import postgres from "postgres";
import type { Db, Row } from "./db.ts";

const QUERY_TIMEOUT_MS = 15_000;

/**
 * A dead or paused database must produce an error in seconds, not hold a
 * Vercel function until its 60s kill. JS-level race rather than a Postgres
 * `statement_timeout` startup parameter, which Supabase's pooler may reject.
 */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`database did not respond within ${Math.round(ms / 1000)}s`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function wrap(sql: postgres.Sql, inTransaction: boolean): Db {
  const self: Db = {
    query: async <T extends Row = Row>(text: string, params: unknown[] = []) =>
      withTimeout(sql.unsafe(text, params as never[]) as unknown as Promise<T[]>, QUERY_TIMEOUT_MS),
    transaction: async <T>(fn: (tx: Db) => Promise<T>) => {
      if (inTransaction) return fn(self);
      return (await sql.begin((tx) => fn(wrap(tx as unknown as postgres.Sql, true)))) as unknown as T;
    },
  };
  return self;
}

/**
 * `prepare: false` and `ssl: "require"` are what Supabase's transaction-mode
 * pooler (port 6543) needs. One connection per serverless instance is plenty.
 */
export function createPostgresDb(url: string): Db {
  const sql = postgres(url, { prepare: false, ssl: "require", max: 1, idle_timeout: 20, connect_timeout: 15 });
  return wrap(sql, false);
}
