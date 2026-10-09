export type TapeTone = "alert" | "working" | "ok" | "warn";
export type TapeItem = { id: string; tone: TapeTone; text: string; retry?: boolean };
export type TapeInput = {
  dbMessage?: string | null;
  chatError?: string | null;
  sync: {
    state: "idle" | "loading" | "done" | "error";
    progress?: string | null;
    waiting?: string | null;
    result?: string | null;
    stop?: string | null;
    error?: string | null;
  };
};

const has = (s: string | null | undefined): s is string => typeof s === "string" && s.trim().length > 0;

/** Which status lines the tape strip shows, in priority order. Empty array = the strip is hidden. */
export function selectTapeItems({ dbMessage, chatError, sync }: TapeInput): TapeItem[] {
  const items: TapeItem[] = [];
  if (has(dbMessage)) items.push({ id: "db", tone: "alert", text: dbMessage });
  if (has(chatError)) items.push({ id: "chat-error", tone: "alert", text: chatError, retry: true });
  if (sync.state === "error" && has(sync.error)) items.push({ id: "sync-error", tone: "alert", text: sync.error });
  if (sync.state === "loading") {
    if (has(sync.progress)) items.push({ id: "sync-progress", tone: "working", text: sync.progress });
    if (has(sync.waiting)) items.push({ id: "sync-waiting", tone: "working", text: sync.waiting });
  }
  if (sync.state === "done") {
    if (has(sync.result)) items.push({ id: "sync-result", tone: "ok", text: sync.result });
    if (has(sync.stop)) items.push({ id: "sync-stop", tone: "warn", text: sync.stop });
  }
  return items;
}
