# Enagram.io

A conversational AI agent over your own Gmail, Google Drive and Google Calendar. Ask
questions in plain language and it searches, correlates and reasons across all three in
a single answer instead of making you search each one separately.

**Live:** https://enagram-io.vercel.app

This is **v2**. v1 ([Halok600/Enagram.io](https://github.com/Halok600/Enagram.io)) used a
separate gbrain server on Render plus a Colab notebook for ingestion; v2 keeps every
feature and replaces that stack with Supabase Postgres + pgvector queried directly from
Vercel, so there is nothing to start by hand.

## What it does

- **Cross-source Q&A** — one answer drawing on Gmail, Drive and Calendar together.
- **Calendar from chat** — create, update and delete real events conversationally, plus a
  full `/calendar` page (month/week view, drag-and-drop rescheduling) sharing the same code.
- **Gmail reply drafting** — drafts (never sends) a correctly threaded reply.
- **Preference memory** — "remember that I prefer concise answers" persists across sessions.
- **Cross-source linking** — items sharing a participant are linked so the agent can follow
  a connection instead of guessing a new search.
- **Streaming chat UI** with animated tool activity and dark/light themes.

## Architecture

```
Browser ── Vercel (Next.js 16) ──┬── Google APIs (Gmail / Drive / Calendar)
                                 ├── Gemini (chat model + embeddings)
                                 └── Supabase Postgres + pgvector
```

- **Search** is hybrid: Postgres full-text (OR-ed terms, English stemming) plus Gemini
  embeddings (768-dim, cosine), merged with Reciprocal Rank Fusion. If the embedding service
  is unavailable, keyword search still works.
- **Sync** runs inside the site in two idempotent phases: fetch and store text, then embed in
  time-boxed chunks. Unchanged documents are never re-embedded.
- **Storage** tables (`enagram_*`) are created automatically on first use.
- Design and plan: `docs/superpowers/specs/` and `docs/superpowers/plans/`.

## Configuration

| Variable | Purpose |
|---|---|
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth |
| `AUTH_SECRET` | NextAuth session encryption |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini chat model and embeddings |
| `DATABASE_URL` | Supabase Postgres connection string (the transaction pooler, port 6543) |
| `CRON_SECRET` | Guards `/api/keepalive`, called daily by Vercel Cron |
| `ALLOWED_EMAILS` | Comma-separated Google account emails allowed to sign in and call the API (unset = unrestricted). **Set it before publishing the Google OAuth app.** |

## Develop

```bash
nvm use            # Node 24 (.nvmrc)
npm ci
npm run dev
npm test           # node:test; SQL runs against in-process Postgres (PGlite) with pgvector
npm run smoke      # live check against DATABASE_URL (needs .env.local)
```

## Reliability

- `/api/health` is public and runs a real database query; a daily Vercel cron and a 12-hourly
  GitHub Actions heartbeat call it so the free-tier database never auto-pauses.
- The UI shows a plain-language banner if the database is paused or unreachable.
- CI (install, test, typecheck, lint, build) runs on every push and weekly.
- Before a demo, follow `docs/DEMO_CHECKLIST.md` (about 2 minutes).
- `/api/diagnose` (signed in) times each layer when something is slow.

## License

MIT
