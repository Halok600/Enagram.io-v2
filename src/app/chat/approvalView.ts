import { isApprovalGatedTool } from "../../lib/query/approval.ts";

/**
 * Pure logic behind the Approve / Deny cards in the chat: what a pending write
 * says in plain language, and which tool parts are waiting on the owner. The
 * React component (ApprovalCard.tsx) only draws what this returns.
 */

type AnyPart = { type: string };
type AnyMessage = { role: string; parts: ReadonlyArray<AnyPart> };

type LoosePart = {
  type: string;
  state?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  approval?: { id?: string; approved?: boolean; isAutomatic?: boolean };
};

export type ApprovalCardStatus = "pending" | "approved" | "declined" | "done" | "failed";

export type ApprovalCardModel = {
  toolCallId: string;
  toolName: string;
  /** Only set while the card is waiting: the id addToolApprovalResponse needs. */
  approvalId?: string;
  sentence: string;
  status: ApprovalCardStatus;
  /** Extra line for a failed action (the tool's own error message). */
  detail?: string;
};

const MAX_TEXT = 160;

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** A non-blank string field, tidied and clipped, or undefined for anything else. */
function text(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const flat = value.replace(/\s+/g, " ").trim();
  if (!flat) return undefined;
  return flat.length > MAX_TEXT ? `${flat.slice(0, MAX_TEXT)}…` : flat;
}

/** "2026-08-17T14:30:00+05:30" -> "2026-08-17 14:30+05:30"; anything else is shown as given. */
function when(value: unknown): string | undefined {
  const raw = text(value);
  if (!raw) return undefined;
  const m = raw.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?$/);
  return m ? `${m[1]} ${m[2]}${m[3] ?? ""}` : raw;
}

const quote = (s: string) => `"${s}"`;

/** What the owner is being asked to allow, as one sentence. Never throws, whatever the model sent. */
export function describeAction(toolName: string, input: unknown, eventTitle?: string): string {
  const i = asRecord(input);

  switch (toolName) {
    case "save_preference": {
      const fact = text(i.fact);
      return fact ? `Save preference: ${quote(fact)}` : "Save a preference (no text given)";
    }
    case "forget_preference": {
      const fact = text(i.fact);
      return fact ? `Forget preference matching: ${quote(fact)}` : "Forget a preference (no text given)";
    }
    case "create_calendar_event": {
      const summary = text(i.summary);
      const start = when(i.startDateTime);
      const end = when(i.endDateTime);
      const location = text(i.location);
      let s = summary ? `Create event ${quote(summary)}` : "Create an event (no title given)";
      if (start && end) s += `, ${start} to ${end}`;
      else if (start) s += `, starting ${start}`;
      else if (end) s += `, ending ${end}`;
      if (location) s += `, at ${location}`;
      return s;
    }
    case "update_calendar_event": {
      const id = text(i.eventId);
      const label = text(eventTitle) ? quote(text(eventTitle) as string) : id;
      const changes: string[] = [];
      const summary = text(i.summary);
      const start = when(i.startDateTime);
      const end = when(i.endDateTime);
      const location = text(i.location);
      const description = text(i.description);
      if (summary) changes.push(`title to ${quote(summary)}`);
      if (start) changes.push(`start to ${start}`);
      if (end) changes.push(`end to ${end}`);
      if (location) changes.push(`location to ${quote(location)}`);
      if (description) changes.push(`description to ${quote(description)}`);
      const head = label ? `Update calendar event ${label}` : "Update a calendar event (no event given)";
      return changes.length > 0 ? `${head}: ${changes.join(", ")}` : `${head} (no changes given)`;
    }
    case "delete_calendar_event": {
      const id = text(i.eventId);
      const label = text(eventTitle) ? quote(text(eventTitle) as string) : id;
      return label ? `Delete calendar event ${label}?` : "Delete a calendar event (no event given)";
    }
    default:
      return `Run ${toolName}`;
  }
}

/**
 * Event titles the model saw in earlier calendar searches, by eventId. An
 * opaque id tells the owner nothing about what a Delete would remove, so the
 * card shows the title when the conversation has it.
 */
export function collectEventTitles(messages: ReadonlyArray<AnyMessage>): Map<string, string> {
  const titles = new Map<string, string>();
  for (const message of messages) {
    for (const raw of message.parts) {
      const part = raw as LoosePart;
      if (part.type !== "tool-search_calendar" || part.state !== "output-available") continue;
      const results = asRecord(part.output).results;
      if (!Array.isArray(results)) continue;
      for (const r of results) {
        const rec = asRecord(r);
        const id = text(rec.eventId);
        const title = text(rec.title);
        if (id && title) titles.set(id, title);
      }
    }
  }
  return titles;
}

function statusOf(part: LoosePart): { status: ApprovalCardStatus; detail?: string } | null {
  switch (part.state) {
    case "approval-requested":
      // Automatic decisions are already settled by the server; there is nothing to click.
      return part.approval?.isAutomatic ? null : { status: "pending" };
    case "approval-responded":
      return { status: part.approval?.approved ? "approved" : "declined" };
    case "output-denied":
      return { status: "declined" };
    case "output-available": {
      const out = asRecord(part.output);
      if (out.status === "error") return { status: "failed", detail: text(out.message) };
      return { status: "done" };
    }
    case "output-error":
      return { status: "failed", detail: text(part.errorText) };
    default:
      // input-streaming / input-available: the model is still composing the call.
      return null;
  }
}

/** One card per write-tool call in a message, in order, with its current state. */
export function getApprovalCards(
  parts: ReadonlyArray<AnyPart>,
  eventTitles: ReadonlyMap<string, string> = new Map(),
): ApprovalCardModel[] {
  const cards: ApprovalCardModel[] = [];
  for (const raw of parts) {
    const part = raw as LoosePart;
    if (!part.type.startsWith("tool-")) continue;
    const toolName = part.type.slice("tool-".length);
    if (!isApprovalGatedTool(toolName)) continue;

    const outcome = statusOf(part);
    if (!outcome) continue;

    const eventId = text(asRecord(part.input).eventId);
    cards.push({
      toolCallId: part.toolCallId ?? `${toolName}-${cards.length}`,
      toolName,
      approvalId: outcome.status === "pending" ? part.approval?.id : undefined,
      sentence: describeAction(toolName, part.input, eventId ? eventTitles.get(eventId) : undefined),
      status: outcome.status,
      detail: outcome.detail,
    });
  }
  return cards;
}

/** True while the newest message is an assistant turn with a write waiting for Approve/Deny. */
export function hasAwaitingApproval(messages: ReadonlyArray<AnyMessage>): boolean {
  const last = messages[messages.length - 1];
  if (!last || last.role !== "assistant") return false;
  return getApprovalCards(last.parts).some((c) => c.status === "pending");
}

/** For the sidebar's "tools running" list: a tool waiting on the owner (or already settled) is not running. */
export function isToolPartInFlight(state: string | undefined): boolean {
  return !(
    state === "output-available" ||
    state === "output-error" ||
    state === "output-denied" ||
    state === "approval-requested"
  );
}
