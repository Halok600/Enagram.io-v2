import type { Db } from "./db.ts";

export const EMBEDDING_DIMENSIONS = 768;

/**
 * Idempotent, run once per cold start (service.ts). Table names are prefixed
 * `enagram_` so they cannot collide with other tables in the same Supabase
 * project. Two cold starts racing `create table if not exists` can make one of
 * them fail; the failure is not cached, so the next request succeeds.
 *
 * `fts` turns `_ . / -` into spaces before tokenising: otherwise a file named
 * `Resume_2026_APRIL.pdf` is one token that a search for "resume" misses.
 */
export const SCHEMA_STATEMENTS: string[] = [
  `create extension if not exists vector`,
  `create table if not exists enagram_documents (
     id           text primary key,
     source       text not null check (source in ('gmail', 'drive', 'calendar')),
     title        text not null,
     body         text not null,
     url          text,
     doc_date     timestamptz,
     participants text[] not null default '{}',
     event_id     text,
     content_hash text not null,
     embedding    vector(${EMBEDDING_DIMENSIONS}),
     fts          tsvector generated always as (
                    to_tsvector('english',
                      regexp_replace(coalesce(title, '') || ' ' || coalesce(body, ''), '[_./-]+', ' ', 'g'))
                  ) stored,
     updated_at   timestamptz not null default now()
   )`,
  `create index if not exists enagram_documents_fts on enagram_documents using gin (fts)`,
  `create index if not exists enagram_documents_participants on enagram_documents using gin (participants)`,
  `create table if not exists enagram_links (
     from_id text not null references enagram_documents(id) on delete cascade,
     to_id   text not null references enagram_documents(id) on delete cascade,
     primary key (from_id, to_id)
   )`,
  `create table if not exists enagram_preferences (
     id         bigserial primary key,
     fact       text not null,
     created_at timestamptz not null default now()
   )`,
  `create table if not exists enagram_meta (key text primary key, value text not null)`,
];

export async function applySchema(db: Db): Promise<void> {
  for (const statement of SCHEMA_STATEMENTS) {
    await db.query(statement);
  }
}
