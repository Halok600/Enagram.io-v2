import { isHttpUrl } from "./safe-url.ts";

export type PeekItem = { key: string; title: string; start: string; href: string | null };
export type PeekView = { status: "ok"; count: number; items: PeekItem[] } | { status: "error"; message: string };

export const PEEK_MAX_ITEMS = 3;
export const PEEK_FAILURE = "Couldn't load calendar summary";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);

/** Shapes the /api/calendar/summary JSON for the hover preview. Never throws; anything unexpected is a generic error. */
export function peekToView(json: unknown): PeekView {
  if (!isRecord(json)) return { status: "error", message: PEEK_FAILURE };
  if (typeof json.error === "string") return { status: "error", message: json.error.trim() === "" ? PEEK_FAILURE : json.error };
  const { eventCountThisMonth: count, upcoming } = json;
  if (typeof count !== "number" || !Number.isFinite(count) || count < 0 || !Array.isArray(upcoming)) {
    return { status: "error", message: PEEK_FAILURE };
  }
  const items: PeekItem[] = [];
  upcoming.forEach((raw: unknown, index) => {
    if (items.length >= PEEK_MAX_ITEMS || !isRecord(raw) || typeof raw.start !== "string") return;
    items.push({
      key: `${raw.start}|${index}`,
      title: typeof raw.summary === "string" ? raw.summary : "(No title)",
      start: raw.start,
      href: isHttpUrl(raw.htmlLink as string | undefined) ? (raw.htmlLink as string) : null,
    });
  });
  return { status: "ok", count, items };
}
