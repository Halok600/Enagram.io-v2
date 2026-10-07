import { createHash } from "node:crypto";
import type { Db } from "./db.ts";
import type { StoredDocument } from "./types.ts";

export const EMBED_TEXT_CHARS = 6000;
const UPSERT_BATCH_SIZE = 25;

/** Postgres text cannot hold NUL bytes, and PDF extraction can emit them. */
function clean(value: string): string {
  return value.replace(/\u0000/g, "");
}

export function contentHash(doc: StoredDocument): string {
  return createHash("sha256")
    .update(JSON.stringify([doc.title, doc.body, doc.url, doc.docDate, doc.participants]))
    .digest("hex");
}

export function embeddingText(title: string, body: string): string {
  return `${title}\n\n${body.slice(0, EMBED_TEXT_CHARS)}`;
}

// One statement per batch (not per row): 100+ documents one round-trip at a
// time would cost many seconds against a remote database.
const UPSERT_SQL = `
  insert into enagram_documents
    (id, source, title, body, url, doc_date, participants, event_id, content_hash)
  select id, source, title, body, url, doc_date, coalesce(participants, '{}'), event_id, content_hash
    from jsonb_to_recordset($1::jsonb) as r(
      id text, source text, title text, body text, url text, doc_date timestamptz,
      participants text[], event_id text, content_hash text)
  on conflict (id) do update set
    source = excluded.source, title = excluded.title, body = excluded.body, url = excluded.url,
    doc_date = excluded.doc_date, participants = excluded.participants, event_id = excluded.event_id,
    content_hash = excluded.content_hash, embedding = null, updated_at = now()`;

export async function upsertDocuments(
  db: Db,
  docs: StoredDocument[],
): Promise<{ total: number; changed: number }> {
  if (docs.length === 0) return { total: 0, changed: 0 };

  const cleaned = docs.map((d) => ({ ...d, title: clean(d.title), body: clean(d.body) }));
  const withHash = cleaned.map((doc) => ({ doc, hash: contentHash(doc) }));

  const existing = await db.query<{ id: string; content_hash: string }>(
    `select id, content_hash from enagram_documents where id = any($1::text[])`,
    [cleaned.map((d) => d.id)],
  );
  const known = new Map(existing.map((r) => [r.id, r.content_hash]));
  const changed = withHash.filter(({ doc, hash }) => known.get(doc.id) !== hash);

  for (let i = 0; i < changed.length; i += UPSERT_BATCH_SIZE) {
    const payload = changed.slice(i, i + UPSERT_BATCH_SIZE).map(({ doc, hash }) => ({
      id: doc.id,
      source: doc.source,
      title: doc.title,
      body: doc.body,
      url: doc.url,
      doc_date: doc.docDate,
      participants: doc.participants,
      event_id: doc.eventId,
      content_hash: hash,
    }));
    await db.query(UPSERT_SQL, [JSON.stringify(payload)]);
  }

  return { total: docs.length, changed: changed.length };
}

/**
 * The calendar fetch is a full window, so anything in it that vanished was deleted in Google.
 *
 * An empty `keepIds` deliberately deletes every calendar document: an empty window means
 * "no events", and calendar rows are a derived copy that the next sync rebuilds from Google.
 * Callers must only call this after a successful, complete calendar fetch (a failed or
 * partial fetch must throw or skip this call, never be mapped to `[]`).
 * Gmail and Drive rows are never touched.
 */
export async function deleteCalendarExcept(db: Db, keepIds: string[]): Promise<number> {
  const rows = await db.query<{ id: string }>(
    `delete from enagram_documents where source = 'calendar' and not (id = any($1::text[])) returning id`,
    [keepIds],
  );
  return rows.length;
}

export type PendingEmbedding = { id: string; hash: string; text: string };

export async function pendingEmbeddings(db: Db, limit: number): Promise<PendingEmbedding[]> {
  const rows = await db.query<{ id: string; content_hash: string; title: string; body: string }>(
    `select id, content_hash, title, left(body, $2::int) as body
       from enagram_documents where embedding is null
      order by updated_at desc, id limit $1::int`,
    [limit, EMBED_TEXT_CHARS],
  );
  return rows.map((r) => ({ id: r.id, hash: r.content_hash, text: embeddingText(r.title, r.body) }));
}

/** Only writes when the row still has the hash the embedding was computed from. */
export async function setEmbeddings(
  db: Db,
  items: { id: string; hash: string; embedding: number[] }[],
): Promise<void> {
  if (items.length === 0) return;
  const payload = items.map((i) => ({ id: i.id, hash: i.hash, embedding: `[${i.embedding.join(",")}]` }));
  await db.query(
    `update enagram_documents d set embedding = r.embedding::vector
       from jsonb_to_recordset($1::jsonb) as r(id text, hash text, embedding text)
      where d.id = r.id and d.content_hash = r.hash`,
    [JSON.stringify(payload)],
  );
}

export async function countPending(db: Db): Promise<number> {
  const [row] = await db.query<{ n: number }>(
    `select count(*)::int as n from enagram_documents where embedding is null`,
  );
  return row.n;
}

export async function countDocuments(db: Db): Promise<number> {
  const [row] = await db.query<{ n: number }>(`select count(*)::int as n from enagram_documents`);
  return row.n;
}
