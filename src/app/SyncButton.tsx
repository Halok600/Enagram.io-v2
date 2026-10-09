"use client";

import { StickerButton } from "./ui/StickerButton";
import { useSync } from "./useSync";

/**
 * Thin wrapper over useSync. The chat screen no longer uses it (the top bar and the tape strip show sync
 * state); it stays only because the old Sidebar still imports it and goes away with the Sidebar in Task 8.
 */
export function SyncButton() {
  const sync = useSync();
  const loading = sync.state === "loading";
  return (
    <StickerButton tone="cobalt" onClick={() => void sync.run()} disabled={loading} className="w-full">
      {loading ? "SYNCING..." : "SYNC"}
    </StickerButton>
  );
}
