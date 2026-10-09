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
