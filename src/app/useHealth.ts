"use client";

import { useEffect, useState } from "react";
import { HEALTH_UNREACHABLE_MESSAGE, dbProblemMessage } from "@/lib/db-errors";
import { HEALTH_LOADING, HEALTH_UNREACHABLE, healthToView, type HealthView } from "@/lib/ui/health";

type HealthState = { view: HealthView; dbMessage: string | null };

const LOADING: HealthState = { view: HEALTH_LOADING, dbMessage: null };

/**
 * Asks /api/health once on mount. The body is read on the 503 too (a down database arrives with a
 * non-ok status and `db: "down"`). A down database gives the plain-words fix from dbProblemMessage; a
 * failed fetch gives HEALTH_UNREACHABLE_MESSAGE (that is not evidence about DATABASE_URL); healthy gives null.
 */
export function useHealth(): HealthState {
  const [state, setState] = useState<HealthState>(LOADING);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => res.json())
      .then((data: { db?: string; reason?: unknown }) => {
        if (cancelled) return;
        setState({
          view: healthToView(data),
          dbMessage: data.db === "down" ? dbProblemMessage(data.reason) : null,
        });
      })
      .catch(() => {
        if (!cancelled) setState({ view: HEALTH_UNREACHABLE, dbMessage: HEALTH_UNREACHABLE_MESSAGE });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
