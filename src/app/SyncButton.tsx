"use client";

import { useState } from "react";
import { motion } from "framer-motion";

type SyncResult = {
  gmailCount: number;
  driveCount: number;
  calendarCount: number;
  pagesWritten: number;
  committed: boolean;
  linksCreated: number;
  indexing: "completed" | "background" | "skipped";
  syncLog: string;
};

type SyncState = "idle" | "loading" | "done" | "error";

export function SyncButton() {
  const [state, setState] = useState<SyncState>("idle");
  const [result, setResult] = useState<SyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setState("loading");
    setError(null);
    try {
      const res = await fetch("/api/ingest/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      setResult(data);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setState("error");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <motion.button
        type="button"
        onClick={handleSync}
        disabled={state === "loading"}
        whileHover={state === "loading" ? undefined : { y: -1, boxShadow: "var(--shadow-md)" }}
        whileTap={state === "loading" ? undefined : { scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-sm font-medium text-[var(--text-primary)] disabled:opacity-40 disabled:hover:shadow-none"
        style={{ boxShadow: "var(--shadow-sm)" }}
      >
        {state === "loading" ? "Syncing..." : "Sync now"}
      </motion.button>

      {state === "done" && result && (
        <>
          <p className="text-xs leading-snug text-[var(--text-tertiary)]">
            {result.gmailCount} email(s) + {result.driveCount} file(s) + {result.calendarCount} event(s) →{" "}
            {result.pagesWritten} page(s)
            {result.committed ? `, synced (${result.linksCreated} link(s))` : " (no changes)"}.
          </p>
          {result.indexing === "skipped" && (
            <p className="text-xs leading-snug text-[var(--danger)]">
              ⚠ Indexing was skipped — another sync was already running (or its lock got stuck). Your
              data above was written and committed, but isn&apos;t searchable yet. Wait a moment and try
              again.
            </p>
          )}
          {result.indexing === "background" && (
            <p className="text-xs leading-snug text-[var(--text-tertiary)]">
              Written and committed — indexing is still running on the sync worker. Check back in a bit.
            </p>
          )}
          {/* Previously silently discarded — gbrain's own sync/embed output was fetched but never
           * shown anywhere, so a stuck lock (which makes every click LOOK successful, since the git
           * commit step really does succeed) had no way to be diagnosed from the browser. Collapsed
           * by default since it's raw CLI output, but auto-opened when something's actually wrong. */}
          <details open={result.indexing !== "completed"} className="text-xs text-[var(--text-tertiary)]">
            <summary className="cursor-pointer select-none hover:text-[var(--text-secondary)]">
              View sync log
            </summary>
            <pre className="mt-1.5 max-h-40 overflow-auto whitespace-pre-wrap rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-panel-raised)] p-2 font-mono text-[11px] leading-snug text-[var(--text-secondary)]">
              {result.syncLog || "(empty)"}
            </pre>
          </details>
        </>
      )}

      {state === "error" && <p className="text-xs leading-snug text-[var(--danger)]">{error}</p>}
    </div>
  );
}
