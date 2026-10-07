export type SourceKind = "gmail" | "drive" | "calendar";

export type StoredDocument = {
  id: string; // "gmail:<id>" | "drive:<id>" | "calendar:<id>"
  source: SourceKind;
  title: string;
  body: string;
  url: string | null;
  docDate: string | null; // ISO 8601
  participants: string[];
  eventId: string | null; // raw Google Calendar event id (calendar only)
};

/** Same shape v1's gbrain search returned, so the chat tools format it unchanged. */
export type BrainSearchHit = {
  slug: string;
  type: "email" | "source" | "event";
  title: string;
  score: number;
  snippet: string;
  url?: string;
  date?: string;
  eventId?: string;
};

export const HIT_TYPE_BY_SOURCE: Record<SourceKind, BrainSearchHit["type"]> = {
  gmail: "email",
  drive: "source",
  calendar: "event",
};
