import type { BrainDocument } from "../brain/types.ts";
import type { StoredDocument } from "../store/types.ts";

/** Drive can return "" and calendar all-day events return a bare date; Postgres rejects the empty string. */
function toIsoDate(value: string): string | null {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

export function toStoredDocument(doc: BrainDocument): StoredDocument {
  const rawId = doc.source === "calendar" ? (doc.raw as { id?: unknown }).id : undefined;
  return {
    id: doc.id,
    source: doc.source,
    title: doc.title,
    body: doc.body,
    url: doc.url ?? null,
    docDate: toIsoDate(doc.timestamp),
    participants: doc.participants,
    eventId: typeof rawId === "string" && rawId.length > 0 ? rawId : null,
  };
}
