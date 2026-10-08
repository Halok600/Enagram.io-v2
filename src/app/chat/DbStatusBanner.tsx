"use client";

import { useEffect, useState } from "react";
import { HEALTH_UNREACHABLE_MESSAGE, dbProblemMessage } from "@/lib/db-errors";

/**
 * If the database is down or paused, say so in plain words and name the fix,
 * instead of leaving a chat that fails with no explanation. Silent when healthy.
 */
export function DbStatusBanner() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { db?: string; reason?: unknown }) => {
        if (!cancelled && data.db === "down") setMessage(dbProblemMessage(data.reason));
      })
      .catch(() => {
        // /api/health itself failed (offline, not JSON): that is not evidence about DATABASE_URL.
        if (!cancelled) setMessage(HEALTH_UNREACHABLE_MESSAGE);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!message) return null;

  return (
    <div
      role="alert"
      className="mb-3 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--danger)]"
    >
      {message}
    </div>
  );
}
