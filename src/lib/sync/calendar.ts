import { listEvents } from "@/lib/google/calendar";
import { calendarEventToBrainDocument } from "@/lib/brain/normalize";
import { getDb, getEmbedder } from "@/lib/store/service";
import { runEmbedPhase, runFetchPhase, type SyncDeps } from "./engine";

const REINGEST_EMBED_BUDGET_MS = 8_000;

/**
 * After a calendar create/update/delete, make the change searchable at once
 * (v1 only did this from the /calendar page, not from chat). Best effort: the
 * Google edit already succeeded, so a failure here is logged and never surfaced
 * as a failed edit.
 */
export async function reingestCalendar(accessToken: string, ownEmail: string): Promise<void> {
  try {
    const db = await getDb();
    const embedder = getEmbedder();
    const deps: SyncDeps = {
      db,
      ownEmail,
      touchLastSynced: false,
      embedDocuments: (texts) => embedder.documents(texts),
      fetchDocuments: async () => ({
        gmail: [],
        drive: [],
        calendar: (await listEvents(accessToken)).map(calendarEventToBrainDocument),
      }),
    };
    await runFetchPhase(deps);
    await runEmbedPhase(deps, REINGEST_EMBED_BUDGET_MS);
  } catch (err) {
    console.error("Calendar re-ingest failed (the Google Calendar edit itself succeeded)", err);
  }
}
