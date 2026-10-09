import type { UIMessage } from "ai";
import type { TapeItem } from "@/lib/ui/tape";

// Generic fixture data for the development-only /design preview. No personal data.

export const TAPE_ITEMS: TapeItem[] = [
  { id: "db", tone: "alert", text: "The database is unreachable. Answers may be out of date." },
  { id: "chat-error", tone: "alert", text: "Something went wrong while answering.", retry: true },
  { id: "sync-progress", tone: "working", text: "Syncing Gmail: 120 of 480 messages." },
  { id: "sync-result", tone: "ok", text: "Synced 480 emails and 32 files." },
  { id: "sync-stop", tone: "warn", text: "Stopped early: daily quota reached." },
];

export const TICKETS: { n: number; title: string; tone: "cobalt" | "sun"; url?: string; score?: number }[] = [
  { n: 1, title: "Quarterly planning notes", tone: "cobalt", url: "https://example.com/mail/1", score: 0.91 },
  { n: 2, title: "Budget spreadsheet (final, really final, v7 with a very long name that must truncate)", tone: "sun", url: "https://example.com/drive/2", score: 0.84 },
  { n: 3, title: "Trip itinerary", tone: "cobalt", score: 0.62 },
];

export const TICKER_NAMES = ["search_gmail", "search_drive"] as const;

export const TONES = ["plain", "cobalt", "sun", "bubblegum"] as const;

/** The three tape situations of the chat shell, each with the sync state the top bar shows next to it. */
export const CHAT_SHELL_TAPES: { label: string; syncState: "idle" | "loading" | "done" | "error"; items: TapeItem[] }[] = [
  {
    label: "database problem",
    syncState: "idle",
    items: [{ id: "db", tone: "alert", text: "The database is paused. Resume it from the hosting dashboard, then reload." }],
  },
  {
    label: "chat error with Retry",
    syncState: "idle",
    items: [{ id: "chat-error", tone: "alert", text: "The model is busy right now. Try again in a minute.", retry: true }],
  },
  {
    label: "sync waiting",
    syncState: "loading",
    items: [
      { id: "sync-progress", tone: "working", text: "120 document(s) left to index..." },
      { id: "sync-waiting", tone: "working", text: "Waiting 40s so Gemini's free-tier limit can recover (120 document(s) left)..." },
    ],
  },
];

// ---- Conversation fixtures (Task 6). Built as real UIMessages so the preview runs the real Chat code. ----

type Part = UIMessage["parts"][number];
const part = (p: Record<string, unknown>) => p as unknown as Part;
const textPart = (text: string): Part => ({ type: "text", text });
const searchPart = (tool: "search_gmail" | "search_drive", results: { title: string; slug: string; score: number; url?: string }[]): Part =>
  part({ type: `tool-${tool}`, toolCallId: `${tool}-1`, state: "output-available", input: {}, output: { results } });

export const FIXTURE_USER_TIME = new Date(2026, 9, 9, 9, 41).getTime();
export const FIXTURE_ANSWER_TIME = new Date(2026, 9, 9, 9, 42).getTime();

const ANSWER_MARKDOWN = `Here is what I found about the **Q3 planning** thread. The main points:

- The budget review moves to *Thursday*
- The owner for the rollout is still open
- Keep \`plan-v3.md\` as the source of truth

Next steps, in order:

1. Confirm the new date with the team
2. Pick an owner for the rollout

The full notes are in [the shared plan](https://example.com/plan). Tell me if you want a short summary instead.`;

export const CONVERSATION_MESSAGES: UIMessage[] = [
  { id: "u1", role: "user", parts: [textPart("What did we decide in the Q3 planning thread?")] },
  {
    id: "a1",
    role: "assistant",
    parts: [
      searchPart("search_gmail", [
        { title: "Q3 planning: budget review", slug: "gmail-1", score: 0.92, url: "https://example.com/mail/1" },
        { title: "Re: Q3 planning: owners for the rollout and the long tail of follow-up tasks", slug: "gmail-2", score: 0.81, url: "https://example.com/mail/2" },
      ]),
      searchPart("search_drive", [{ title: "Q3 plan v3", slug: "drive-1", score: 0.77, url: "https://example.com/drive/1" }]),
      textPart(ANSWER_MARKDOWN),
    ],
  },
  { id: "u2", role: "user", parts: [textPart("Thanks! Remind me what is on my calendar tomorrow.")] },
];

export const CONVERSATION_TIMES = { user: [FIXTURE_USER_TIME, FIXTURE_USER_TIME + 5 * 60_000], assistant: { a1: FIXTURE_ANSWER_TIME } };

const SHORT_PREFERENCE = "I prefer meetings after 10am and no calls on Fridays.";

// About 600 characters with line breaks, so the details box has to scroll.
export const LONG_PREFERENCE = `Meeting preferences:
- Prefer meetings after 10am and before 4pm, in my local time.
- No calls on Fridays unless it is an emergency.
- Keep a 15 minute gap between back to back meetings.

Email preferences:
- Summaries should be short: three bullet points at most, plain language.
- Always mention who needs a reply and by when.
- Quote the original sender's exact wording only when it matters.

Files:
- Treat anything in the Planning folder as the source of truth.
- Older drafts with "old" or "copy" in the name can be ignored.`;

const approvalPart = (tool: string, id: string, state: string, input: Record<string, unknown>, extra: Record<string, unknown> = {}): Part =>
  part({ type: `tool-${tool}`, toolCallId: `${tool}-${id}`, state, input, approval: { id: `approval-${id}` }, ...extra });

export const APPROVAL_SHORT_MESSAGES: UIMessage[] = [
  { id: "u1", role: "user", parts: [textPart("Remember that I like meetings after 10am.")] },
  {
    id: "a1",
    role: "assistant",
    parts: [textPart("I can save that for you. Please confirm first."), approvalPart("save_preference", "1", "approval-requested", { fact: SHORT_PREFERENCE })],
  },
];

export const APPROVAL_LONG_MESSAGES: UIMessage[] = [
  { id: "u1", role: "user", parts: [textPart("Save all of my working preferences.")] },
  {
    id: "a1",
    role: "assistant",
    parts: [textPart("Here is everything I would save. Please read it, then choose."), approvalPart("save_preference", "1", "approval-requested", { fact: LONG_PREFERENCE })],
  },
  {
    id: "a2",
    role: "assistant",
    parts: [
      approvalPart("save_preference", "2", "approval-responded", { fact: SHORT_PREFERENCE }, { approval: { id: "approval-2", approved: true } }),
      approvalPart("save_preference", "3", "output-available", { fact: SHORT_PREFERENCE }, { output: { status: "ok" } }),
      approvalPart("forget_preference", "4", "output-denied", { fact: "meetings after 10am" }),
      approvalPart("save_preference", "5", "output-available", { fact: SHORT_PREFERENCE }, { output: { status: "error", message: "The database did not respond." } }),
    ],
  },
];

export const WORKING_MESSAGES: UIMessage[] = [
  { id: "u1", role: "user", parts: [textPart("Find the latest budget files.")] },
  { id: "a1", role: "assistant", parts: [] },
];
