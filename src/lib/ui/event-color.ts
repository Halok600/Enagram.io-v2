export type EventColor = "cobalt" | "sun" | "bubblegum";
export const EVENT_COLORS: readonly EventColor[] = ["cobalt", "sun", "bubblegum"];

/** Stable colour per event id so an event keeps its colour across renders and reloads. */
export function eventColor(id: string): EventColor {
  let h = 0;
  for (const ch of id) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return EVENT_COLORS[h % EVENT_COLORS.length];
}
