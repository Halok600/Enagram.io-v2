/**
 * Fire-and-forget re-sync trigger, called after any live Calendar
 * mutation from the /calendar page (create/update/delete) so the chat
 * agent can find the change without waiting for an unrelated sync —
 * same pattern Workspace.tsx already uses client-side for auto-sync-on-
 * load, just triggered server-side here since the mutation itself is a
 * server route. `origin` must come from the incoming request (server-side
 * fetch can't resolve a relative path against the app's own origin).
 * Gated by `ingestionEnabled` — same local-dev-only limitation as every
 * other ingestion-touching feature (Vercel has no local gbrain/git repo).
 *
 * `cookieHeader` MUST be forwarded explicitly — unlike a browser's
 * `fetch()`, Node's server-side `fetch()` does NOT automatically attach
 * cookies from the enclosing request, since this is a genuinely new,
 * unrelated outgoing HTTP request from the server's point of view. This
 * was a real bug (found in the 2026-08-13 code-review pass, not caught
 * live before then): without it, /api/ingest/sync's own auth() call sees
 * no session at all, returns 401, and — since fetch() only rejects its
 * promise on network-level failure, not on an HTTP error status — the
 * .catch() below never even fired, so the whole feature silently no-op'd
 * on every single call with no visible symptom anywhere.
 */
export function triggerResync(origin: string, ingestionEnabled: boolean, cookieHeader: string | null): void {
  if (!ingestionEnabled) return;
  fetch(`${origin}/api/ingest/sync`, {
    method: "POST",
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  })
    .then((res) => {
      if (!res.ok) {
        console.error(`Background re-sync after calendar mutation failed: HTTP ${res.status}`);
      }
    })
    .catch((err) => {
      console.error("Background re-sync after calendar mutation failed", err);
    });
}
