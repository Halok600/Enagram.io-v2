"use client";

import { useEffect, useState } from "react";
import { DB_PROBLEM_MESSAGES, type DbProblemKind } from "@/lib/db-errors";

/**
 * If the database is down or paused, say so in plain words and name the fix,
 * instead of leaving a chat that fails with no explanation. Silent when healthy.
 */
export function DbStatusBanner() {
  const [problem, setProblem] = useState<DbProblemKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { db?: string; reason?: DbProblemKind }) => {
        if (!cancelled && data.db === "down") setProblem(data.reason ?? "unknown");
      })
      .catch(() => {
        if (!cancelled) setProblem("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!problem) return null;

  return (
    <div
      role="alert"
      className="mb-3 rounded-[var(--radius-md)] border border-[var(--danger)] bg-[var(--bg-panel)] px-4 py-3 text-sm text-[var(--danger)]"
    >
      {DB_PROBLEM_MESSAGES[problem]}
    </div>
  );
}
