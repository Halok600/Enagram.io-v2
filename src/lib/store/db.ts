export type Row = Record<string, unknown>;

/**
 * The only SQL surface the store needs. Production wraps the `postgres` driver
 * (pg.ts); tests wrap in-process PGlite (test-db.ts). Nothing outside
 * src/lib/store/ imports a driver.
 */
export interface Db {
  query<T extends Row = Row>(text: string, params?: unknown[]): Promise<T[]>;
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}
