"use client";

import { useState } from "react";
import { runFullSync, syncStopMessage, waitingMessage } from "./syncClient";
import { syncResultLine } from "@/lib/ui/sync-line";

export type SyncState = "idle" | "loading" | "done" | "error";

export type SyncView = {
  state: SyncState;
  progress: string | null;
  waiting: string | null;
  result: string | null;
  stop: string | null;
  error: string | null;
  run: () => Promise<void>;
};

/** The manual "Sync now" run, with the same progress and waiting messages the old SyncButton showed. */
export function useSync(): SyncView {
  const [state, setState] = useState<SyncState>("idle");
  const [result, setResult] = useState<string | null>(null);
  const [stop, setStop] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<string | null>(null);

  async function run() {
    setState("loading");
    setError(null);
    setProgress(null);
    setWaiting(null);
    setResult(null);
    setStop(null);
    try {
      const final = await runFullSync({
        onProgress: (p) => setProgress(p.remaining > 0 ? `${p.remaining} document(s) left to index...` : null),
        onWait: (wait) => setWaiting(wait ? waitingMessage(wait) : null),
      });
      setResult(syncResultLine({ ...final, counts: final.counts ?? undefined }));
      setStop(syncStopMessage(final));
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed");
      setState("error");
    }
  }

  return { state, progress, waiting, result, stop, error, run };
}
