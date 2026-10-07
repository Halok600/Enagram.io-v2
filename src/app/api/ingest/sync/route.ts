import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { listRecentMessages } from "@/lib/google/gmail";
import { listRecentFiles } from "@/lib/google/drive";
import { listEvents } from "@/lib/google/calendar";
import {
  calendarEventToBrainDocument,
  driveFileToBrainDocument,
  gmailMessageToBrainDocument,
} from "@/lib/brain/normalize";
import { countDocuments, countPending } from "@/lib/store/documents";
import { getMeta } from "@/lib/store/meta";
import { getDb, getEmbedder } from "@/lib/store/service";
import { runEmbedPhase, runFetchPhase, type SyncDeps, type SyncProgress } from "@/lib/sync/engine";
import { GoogleFetchError, syncErrorMessage } from "@/lib/sync/errors";
import { shouldAutoSync } from "@/lib/sync/throttle";

// The embed phase budgets ~40s of work; leave the rest for Google fetches and the response.
export const maxDuration = 60;

const DEFAULT_MAX_PER_SOURCE = 100;

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = (await req.json().catch(() => ({}))) as { phase?: string; auto?: boolean };
  const phase = body.phase === "embed" ? "embed" : "fetch";

  try {
    const db = await getDb();

    // Auto-sync on page load: skip if a sync finished recently (protects Gmail's per-user quota).
    if (phase === "fetch" && body.auto === true) {
      const last = await getMeta(db, "last_synced_at");
      if (!shouldAutoSync(last === null ? null : Number(last), Date.now())) {
        const skipped: SyncProgress = {
          phase: "fetch",
          skipped: true,
          counts: null,
          documents: await countDocuments(db),
          changed: 0,
          embedded: 0,
          remaining: await countPending(db),
        };
        return NextResponse.json(skipped);
      }
    }

    const embedder = getEmbedder();
    const deps: SyncDeps = {
      db,
      ownEmail: session.user?.email ?? "",
      embedDocuments: (texts) => embedder.documents(texts),
      fetchDocuments: async () => {
        // SAFETY CONTRACT: the calendar array returned here MUST be the complete
        // result of a successful fetch. If any Google source fails, the error must
        // propagate (the Promise.all rejects) and must never be turned into an
        // empty list: the engine deletes calendar rows that are missing from the
        // fetched window, so an empty window would delete every calendar row.
        // The failure is re-thrown tagged as a GoogleFetchError (so it is not
        // mistaken for a database problem); it still propagates. Never return,
        // swallow or add per-source fallbacks here.
        let messages, files, events;
        try {
          [messages, files, events] = await Promise.all([
            listRecentMessages(session.accessToken, DEFAULT_MAX_PER_SOURCE),
            listRecentFiles(session.accessToken, DEFAULT_MAX_PER_SOURCE),
            listEvents(session.accessToken),
          ]);
        } catch (err) {
          throw new GoogleFetchError(err);
        }
        return {
          gmail: messages.map(gmailMessageToBrainDocument),
          drive: files.map(driveFileToBrainDocument),
          calendar: events.map(calendarEventToBrainDocument),
        };
      },
    };

    const progress = phase === "embed" ? await runEmbedPhase(deps) : await runFetchPhase(deps);
    return NextResponse.json(progress);
  } catch (err) {
    console.error("Ingestion sync failed", err);
    const message = syncErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
