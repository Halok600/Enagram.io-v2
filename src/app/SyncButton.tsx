"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { runFullSync, syncStopMessage, waitingMessage, type FullSyncResult } from "./syncClient";

type SyncState = "idle" | "loading" | "done" | "error";

export function SyncButton() {
  const [state, setState] = useState<SyncState>("idle");
  const [result, setResult] = useState<FullSyncResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);

  async function handleSync() {
    setState("loading");
    setError(null);
    setProgress(null);
    setWaiting(null);
    try {
      const final = await runFullSync({
        onProgress: (p) => setProgress(p.remaining > 0 ? `${p.remaining} document(s) left to index...` : null),
        onWait: (wait) => setWaiting(wait ? waitingMessage(wait) : null),
      });
      setResult(final);
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setState("error");
    }
  }

  const stopMessage = state === "done" && result ? syncStopMessage(result) : null;

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

      {state === "loading" && progress && (
        <p className="text-xs leading-snug text-[var(--text-tertiary)]">{progress}</p>
      )}
      {state === "loading" && waiting && (
        <p className="text-xs leading-snug text-[var(--text-tertiary)]">{waiting}</p>
      )}

      {state === "done" && result && (
        <>
          <p className="text-xs leading-snug text-[var(--text-tertiary)]">
            {result.counts
              ? `${result.counts.gmail} email(s) + ${result.counts.drive} file(s) + ${result.counts.calendar} event(s) → `
              : ""}
            {result.documents} document(s)
            {result.changed > 0 ? `, ${result.changed} updated` : " (no changes)"}.
          </p>
          {stopMessage && <p className="text-xs leading-snug text-[var(--danger)]">⚠ {stopMessage}</p>}
        </>
      )}

      {state === "error" && <p className="text-xs leading-snug text-[var(--danger)]">{error}</p>}
    </div>
  );
}
