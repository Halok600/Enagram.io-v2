# Enagram.io v2 — Design

Date: 2026-10-07 · Owner: Priyanshu Kumar Tiwari · Status: approved in chat, pending written-spec review

## 1. Why v2

v1 (github.com/Halok600/Enagram.io) works as a product but depends on three
separately-run services: the Vercel site, a gbrain MCP server on Render, and a
Colab notebook (behind ngrok) that must be rebuilt by hand every session because
gbrain ingestion needs a local binary and a git-tracked folder. On 2026-10-07 the
chain failed three ways: the free Supabase project auto-paused (Render
crash-looped, every chat hit Vercel's 60s limit), a stale Colab worker held its
port, and gbrain `search` through Render took 30s+ (it measured ~7s warm in
August). The code is sound; the topology is the fragile part, and the Colab
ritual cannot be removed while gbrain stays.

**Goal:** the same app, same features, same look, with the storage/search/ingestion
layer replaced so that only **Vercel + Supabase** (plus Google and Gemini APIs) are
involved. Pressing Sync works any time, from anywhere, with no notebook.

**Non-goals:** new features; touching the old gbrain data in Supabase; migrating
v1 saved preferences (the user re-tells the agent); multi-user support; deleting
old Gmail/Drive documents that scroll out of the "recent N" windows.

## 2. What carries over unchanged

UI (`src/app/**` pages, components, theme, calendar page), NextAuth Google login and
scopes, `src/lib/google/*` (Gmail incl. throttling/backoff, Drive, Calendar),
`src/lib/query/*` (system prompt, tool definitions, 28s tool budget, model id),
`src/lib/auth-guard.ts`, the chat route's error handling, the eval suite, the test
runner (`node:test`), and the MIT license. Auth env vars are unchanged.

Not copied: `gbrain-server/`, `COLAB_RUNBOOK.md`, `scripts/ingest-worker.ts`,
`src/lib/brain/{gbrain-remote,gbrain-cli,ingest-tunnel,write,markdown,trigger-resync}.ts`,
v1's JOURNAL/SPEC/PROJECT_REFERENCE (history stays in v1). v2 gets a fresh README
that links to v1 for lineage.

## 3. Architecture

```
Browser ── Vercel (Next.js 16) ──┬── Google APIs (Gmail / Drive / Calendar)
                                 ├── Gemini (chat model + embeddings)
                                 └── Supabase Postgres + pgvector  (via DATABASE_URL, pooler)
```

New module `src/lib/store/` owns everything database-related. It is built on one
small interface, `Db` (`query(sql, params)` and `transaction(fn)`), with two
implementations: the `postgres` driver in production (`prepare: false`, SSL
required, a 15s timeout — correct for Supabase's transaction pooler) and in-process
PGlite in tests. Purpose-specific modules sit on top of `Db`: documents
(upsert, hashing, embedding bookkeeping), search, links, preferences, meta and
health, plus a `Brain` facade (`searchGmail/Drive/Calendar`, `getPreferences`,
`savePreference`, `forgetPreference`, `findRelated`) that the chat tools call.
Nothing outside `src/lib/store/` imports a database driver, so tools, routes and
sync are tested against real SQL without any external database.

## 4. Data model (created automatically on first use)

`ensureSchema()` runs idempotent `CREATE ... IF NOT EXISTS` once per cold start.
No SQL for the user to run. All names are prefixed `enagram_` so they cannot
collide with gbrain's tables in the same Supabase project.

```sql
create extension if not exists vector;

create table if not exists enagram_documents (
  id           text primary key,                 -- "gmail:<id>" | "drive:<id>" | "calendar:<id>"
  source       text not null check (source in ('gmail','drive','calendar')),
  title        text not null,
  body         text not null,
  url          text,
  doc_date     timestamptz,
  participants text[] not null default '{}',
  event_id     text,                             -- raw Google event id (calendar only)
  content_hash text not null,                    -- sha256(title + body + url + doc_date)
  embedding    vector(768),                      -- null until embedded
  fts          tsvector generated always as
                 (to_tsvector('english',
                    regexp_replace(coalesce(title,'') || ' ' || coalesce(body,''), '[_./-]+', ' ', 'g'))) stored,
  updated_at   timestamptz not null default now()
);
create index if not exists enagram_documents_fts on enagram_documents using gin (fts);
create index if not exists enagram_documents_participants on enagram_documents using gin (participants);

create table if not exists enagram_links (
  from_id text not null references enagram_documents(id) on delete cascade,
  to_id   text not null references enagram_documents(id) on delete cascade,
  primary key (from_id, to_id)
);

create table if not exists enagram_preferences (
  id bigserial primary key, fact text not null, created_at timestamptz not null default now()
);

create table if not exists enagram_meta (key text primary key, value text not null);
```

~200 documents, so no vector index: an exact scan is fast and avoids index
tuning. Embeddings are Gemini `gemini-embedding-001` at 768 dimensions (the same
model and size v1 used), called through the AI SDK embedding API; the exact call
and provider options are verified against the installed SDK's docs during
implementation. One vector per document from `title + first ~6,000 characters` of
the body (the embedding model's input limit); the **entire** body stays
keyword-searchable through `fts`.

## 5. Search (replaces gbrain `search`)

Hybrid, then merged with Reciprocal Rank Fusion (k = 60):

1. **Vector:** embed the query; top 30 by cosine distance (`embedding <=> $q`),
   only rows with an embedding.
2. **Keyword:** the question is split into alphanumeric terms (max 12) and
   OR-ed into a `to_tsquery('english', 't1 | t2 | ...')`, matched against `fts`,
   top 30 by `ts_rank_cd`. OR, not AND: verified on 2026-10-07 that
   `websearch_to_tsquery` ANDs every word, so the full sentence "Update me for the
   TCS mail which came?" matched zero documents, while the OR query ranks the TCS
   email first. The `english` configuration drops stop words and stems; the `fts`
   expression turns `_ . / -` into spaces first, because otherwise a file named
   `Resume_2026_APRIL.pdf` is one token that a search for "resume" misses (also
   verified).
3. Optional `source` filter applied inside both queries (v1 over-fetched and
   filtered afterwards; this is exact).
4. Fuse the two ranked lists, return the top `limit`. Each hit:
   `{ slug: id, type, title, score, snippet, url, date, eventId }` — the same shape
   the tools already format. Snippet is `ts_headline` around the match when the
   keyword side matched, else the first ~400 characters.

Why hybrid: an exact token like "TCS" must outrank semantically-similar
newsletters, which is what failed in v1 on 2026-10-07. Documents still missing
an embedding remain findable by keyword, so a failed embedding never hides data.
Because url/date/eventId are columns, v1's per-hit `get_page` round-trips
(`MAX_URL_LOOKUPS`) disappear entirely.

## 6. Sync (replaces the Colab worker)

`POST /api/ingest/sync` runs two idempotent phases and returns
`{ phase, processed, remaining, total, changed }`. The client calls it once with
`{ phase: "fetch" }` (the default), then, while `remaining > 0`, repeatedly with
`{ phase: "embed" }` (which skips Google entirely) until `remaining === 0`, so the
first full sync works under Vercel's 60s limit.

- **Phase `fetch`** (default): fetch Gmail (100 most recent, excluding
  Promotions/Social, as v1), Drive (as v1), Calendar (30 days back / 90 forward)
  using the existing Google clients; normalize with the existing
  `normalize.ts` mapping (kept; drops the gbrain-markdown dependency); upsert text
  by `id`. If `content_hash` differs, store the new text and set `embedding = null`.
  Calendar documents absent from the fetched window are deleted (events deleted in
  Google disappear). Gmail/Drive are never deleted.
- **Phase `embed`**: embed rows with `embedding is null` in batches until a ~40s
  time budget is spent; report how many remain. Embedding failures (e.g. free-tier
  rate limits) are logged and leave rows pending for the next call — they never
  fail the sync.
- **Links:** after a sync that changed something, rebuild `enagram_links`
  deterministically from `participants` with v1's rules (cross-source pairs only,
  skip the user's own address, skip participants appearing in more than 6
  documents, cap 200 links). Replaced in one transaction.
- **Auto-sync on page load** keeps working but is throttled: skipped when
  `enagram_meta.last_synced_at` is under 10 minutes old, so reloads can't burn
  Gmail quota (the 2026-10-07 quota errors came from a sync on every load).
- **Calendar edits** (chat tools and `/calendar` page) re-ingest calendar documents
  inline, best effort: errors are logged and never fail the user's edit.

## 7. Tools and chat

Tool names, schemas, descriptions and the system prompt are unchanged. Wiring:
`search_gmail/drive/calendar` → `searchDocuments({source})`; `find_related` →
one SQL query over `enagram_links`; `save_preference`/`forget_preference` →
rows in `enagram_preferences` (substring match, max 30 kept, same
`already_known` / `not_found` results); preferences are read once per chat request
and injected as in v1. A failed preference *read* must never lead to a write
(save/forget fail loudly; only the chat's injection read fails soft). DB calls use
a 15s statement/connect timeout so a dead database errors fast, not at Vercel's kill.

## 8. Configuration

| Variable | Status |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, auth secret, `GOOGLE_GENERATIVE_AI_API_KEY` | unchanged, already in the Vercel project |
| `DATABASE_URL` | **new** — Supabase pooler connection string (the same one Render uses as its DB URL) |
| `ALLOWED_EMAILS` | **new** — comma-separated Google emails allowed to sign in and call any API route (unset = unrestricted, so the live deployment keeps working); must be set before the Google OAuth app is published, because every route reads one shared database |
| `CRON_SECRET` | must be set in Vercel (the keepalive returns 401 without it); the daily `/api/keepalive` cron stays and now runs `select 1` plus a row count against Supabase directly |
| `GBRAIN_*`, `INGEST_TUNNEL_*` | removed; Render, Colab and ngrok can be shut down |

Optional later tweak: pin the Vercel function region near Supabase's region to cut
round-trip time. Measured, not assumed.

## 9. Errors and observability

Every DB/Google/Gemini call has a bounded timeout and a readable message. Tool
errors are logged server-side with the tool name so a failing chat can be
diagnosed from Vercel logs. `/api/diagnose` (signed-in only) times a DB ping, a
keyword query and a vector query and reports them, replacing v1's gbrain
diagnostics.

## 10. Testing

- Unit tests (`node:test`) for pure logic: RRF fusion, content-hash diffing,
  link building, sync time-budget/remaining accounting, preference rules, tool
  result formatting.
- SQL is tested for real against in-process Postgres with pgvector (PGlite):
  schema creation, upsert/hash invalidation, vector + keyword search, link
  replacement, calendar deletion. If PGlite lacks a needed feature, that test falls
  back to the fake store plus the smoke check below.
- `npm run smoke` (not in CI) runs schema + a tiny insert/search/cleanup against the
  real `DATABASE_URL`, using a throwaway `enagram_smoke_` id prefix.
- Existing v1 tests that survive (Gmail backoff, tool budget, cron auth) are ported.
- Verification before any success claim: `npm test`, `tsc --noEmit`, `eslint`,
  `next build`, then a live check after deploy (sync, then the TCS question).

## 11. Cutover and rollback

1. Create public repo `Halok600/Enagram.io-v2`; first commit is this spec, then the
   code in reviewable commits. Every commit is authored by the user only — no
   Co-Authored-By or generated-with lines, now or later.
2. In the existing Vercel project: Settings → Git → connect the v2 repo; add
   `DATABASE_URL`; redeploy. Same URL, no Google OAuth changes.
3. Press Sync now until complete; verify chat (TCS question, calendar, preference).
4. Make v1 private; update the portfolio's Enagram links to v2.
5. Shut down Render, Colab and ngrok at leisure.

Rollback before step 4: reconnect the Vercel project to the v1 repo and redeploy;
v1 and its Render/Supabase data are untouched throughout.

## 12. Risks

- Supabase free tier can still pause after a week idle → daily keepalive, now a
  real DB query.
- Gemini free-tier embedding limits could slow the first sync → chunked embed
  phase; keyword search works meanwhile.
- Documents longer than ~6,000 characters are semantically embedded from their
  start only (keyword search covers all of it).
- Vercel ↔ Supabase distance affects latency; target ≤ 2s per search, to be
  measured after deploy.

## 13. Demo-readiness (a first-class requirement)

Added 2026-10-07 at the user's request: the project must work when shown to an
interviewer, including after weeks of not being touched. v1 worked when last used,
then silently stopped — a free-tier database paused, and the Colab/ngrok/Render
chain needed manual rebuilding. v2 is built so that idle time cannot break it, and
so that if something does break, it says so quickly and plainly.

**No manual runtime pieces.** Nothing to start before a demo: no notebook, tunnel or
extra server. Opening the site is the whole procedure.

**Two independent heartbeats** so the free Supabase project never pauses:
the daily Vercel cron (`/api/keepalive`, guarded by `CRON_SECRET`), and a GitHub
Actions schedule (every 12h) that calls the public `/api/health`, which runs a real
`select 1`. Known limit: GitHub disables scheduled workflows on a public repo after
60 days without repo activity, so the Vercel cron is the primary line.

**`/api/health` (public, no secrets, no personal data):** returns only
`{ db: "ok" | "down", documents: <count>, lastSyncedAt }`. It makes no Gemini or
Google calls, so it cannot be abused to burn quota. `/api/diagnose` (signed-in)
adds the deep checks: Gemini embedding call, Google token validity, timings.

**Plain-language failure states in the UI.** If the database is unreachable or
paused (connection refused, `tenant/user not found`, timeout), the page shows a
banner naming the problem and the fix ("Database is paused — open Supabase and
press Restore"), not an endless spinner. If the Google session has expired, it shows
"Reconnect Google" (the 401 path v1 already had, made explicit).

**Anti-rot build hygiene.** Exact dependency versions in `package.json` (no `^` on
Next, AI SDK, NextAuth), lockfile committed, Node 24 pinned for local work and CI via `.nvmrc`. No
`engines` field is set: Vercel's own project Node setting is what builds the site
today, and an `engines` mismatch could break the deploy. A GitHub Actions workflow runs install, tests, typecheck, lint and
`next build` on every push and weekly, so a broken dependency or toolchain shows up
as a red check and an email long before an interview.

**Pre-demo checklist** (`docs/DEMO_CHECKLIST.md`, about 2 minutes): `/api/health` is
ok; sign in; Sync now; ask two sample questions; for each step, what a failure means
and the single fix. Includes a recommendation to record a 60-second screen capture of
the working app and link it from the README, as a fallback if the live site is ever
unavailable during an interview.

**Google OAuth caveat to verify (cannot be checked from code):** a Google OAuth app
left in "Testing" status has its refresh tokens expire after 7 days, forcing a
re-login. Signing in again fixes it, but for a hands-off demo the consent screen
should be set to "In production" (an unverified app is limited to 100 users and
shows a warning screen, acceptable for a personal project). The user checks this in
Google Cloud Console; the checklist reminds them.

### Definition of "deployable" (acceptance criteria for v2)

v2 is not reported done until all of these have been observed, not assumed:

1. `npm ci`, `npm test`, `tsc --noEmit`, `eslint` and `next build` pass from a clean
   clone of the v2 repo, and the GitHub Actions run is green.
2. The Vercel production deployment of the v2 repo finished successfully on the
   existing URL.
3. `/api/health` on the live URL returns `db: "ok"`.
4. A full sync completed on the live site (the user signs in; counts reported).
5. The TCS question and one calendar question were answered on the live site within
   the 60s limit.
6. The deploy worked from the repo alone: no step depends on a laptop, notebook or
   locally-held file.

Items 4 and 5 need the user's Google sign-in, so the user performs them and shares
the result; the rest are verified by direct requests against the live URL.
