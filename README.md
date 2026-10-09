# Enagram.io

A conversational AI agent over your own Gmail, Google Drive and Google Calendar. Ask
questions in plain language and it searches, correlates and reasons across all three in
a single answer instead of making you search each one separately.

**Live:** https://enagram-io.vercel.app

This is **v2**, rebuilt from an earlier version that ran on Render and Colab. That version
used a separate gbrain server plus a Colab notebook for ingestion; v2 keeps every feature
and replaces that stack with Supabase Postgres + pgvector queried directly from Vercel, so
there is nothing to start by hand.

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
| `ALLOWED_EMAILS` | Comma-separated Google account emails allowed to sign in and call the API. Set it in Vercel; unset or empty = unrestricted; any other value with no valid entries (for example `,` or only spaces) = nobody can sign in. **Set it before publishing the Google OAuth app.** |
| `TOOL_APPROVAL_SECRET` | Recommended for production (optional in code). Makes the chat's Approve/Deny requests tamper-proof: each is signed, so a forged "approved" message from the browser is rejected. Without it, approvals still work but are unsigned, so someone who can send requests to `/api/chat` with your session could craft one. Generate with `openssl rand -base64 32` and set **one** value in Vercel (it must be identical on every instance, since one instance signs and another may verify). |

## Develop

```bash
nvm use            # Node 24 (.nvmrc)
npm ci
npm run dev
npm test           # node:test; SQL runs against in-process Postgres (PGlite) with pgvector
npm run smoke      # live check against DATABASE_URL (from .env.local or the environment)
```

## Reliability

- `/api/health` is public and runs a real database query; a daily Vercel cron and a 12-hourly
  GitHub Actions heartbeat call it, which helps keep the free-tier database from pausing.
  GitHub disables scheduled workflows after 60 days of repository inactivity; push a commit
  or re-enable the workflow in the Actions tab to restore the heartbeat.
- The UI shows a plain-language banner if the database is paused or unreachable.
- CI (install, test, typecheck, lint, build) runs on every push and weekly.
- Before a demo, follow `docs/DEMO_CHECKLIST.md` (about 2 minutes).
- `/api/diagnose` (signed in) times each layer when something is slow.

## Known limitations

- Anything that writes needs your click. Saving or forgetting a preference and creating, changing
  or deleting a calendar event stop in the chat with an Approve / Deny card, and nothing runs until
  you press Approve. So text inside an email or document cannot make the assistant change your data
  on its own (prompt injection). Gmail replies are only ever saved as drafts for you to review, and
  created events never invite anyone.
- Reading is still automatic. The assistant searches your mail, files and calendar without asking,
  so text inside a message it reads could still steer what it says or searches for (it cannot
  change anything without your Approve). Sign-in is limited to an allowlist (`ALLOWED_EMAILS`) and
  the data API routes require the owner's session.

## License

MIT
