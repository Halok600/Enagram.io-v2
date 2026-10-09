export type HealthView = { status: "loading" | "ok" | "down" | "unreachable"; documents: number | null };
export const HEALTH_LOADING: HealthView = { status: "loading", documents: null };
export const HEALTH_UNREACHABLE: HealthView = { status: "unreachable", documents: null };

export function healthToView(json: unknown): HealthView {
  if (!json || typeof json !== "object") return HEALTH_UNREACHABLE;
  const { db, documents } = json as { db?: unknown; documents?: unknown };
  if (db === "ok") return { status: "ok", documents: typeof documents === "number" ? documents : null };
  if (db === "down") return { status: "down", documents: null };
  return HEALTH_UNREACHABLE;
}
