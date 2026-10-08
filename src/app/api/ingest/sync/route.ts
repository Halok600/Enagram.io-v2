import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { listRecentMessages } from "@/lib/google/gmail";
import { listRecentFiles } from "@/lib/google/drive";
import { listEventsWindow } from "@/lib/google/calendar";
import {
  calendarEventToBrainDocument,
  driveFileToBrainDocument,
  gmailMessageToBrainDocument,
} from "@/lib/brain/normalize";
import { countDocuments, countPending } from "@/lib/store/documents";
import { getMeta } from "@/lib/store/meta";
import { getDb, getEmbedder } from "@/lib/store/service";
import { runEmbedPhase, runFetchPhase, type SyncDeps, type SyncProgress } from "@/lib/sync/engine";
import { syncErrorMessage } from "@/lib/sync/errors";
import { guardGoogleFetch } from "@/lib/sync/google-fetch";
import { parseSyncRequest } from "@/lib/sync/request";
import { shouldAutoSync } from "@/lib/sync/throttle";

// The embed phase stops starting new work ~35s after the request began; the rest is for
// one final embedding call and the response.
export const maxDuration = 60;

const DEFAULT_MAX_PER_SOURCE = 100;
// Under maxDuration with room left for the upsert, relink and response.
const GOOGLE_FETCH_TIMEOUT_MS = 40_000;

export async function POST(req: NextRequest) {
  const requestStart = Date.now();
  const { session, error } = await requireSession();
  if (error) return error;

  const parsed = parseSyncRequest(await req.json().catch(() => ({})));
  if (!parsed) return NextResponse.json({ error: "Unknown sync phase" }, { status: 400 });
  const { phase, auto } = parsed;

  try {
    const db = await getDb();

    // Auto-sync on page load: skip if a sync finished recently (protects Gmail's per-user quota).
    if (phase === "fetch" && auto) {
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
        // result of a successful fetch. If any Google source fails or the fetch
        // times out, the error must propagate (guardGoogleFetch rejects) and must
        // never be turned into an empty list: the engine deletes calendar rows that
        // are missing from the fetched window, so an empty window would delete every
        // calendar row. A list cut short by the page cap is flagged `calendarTruncated`
        // so the engine skips that deletion. guardGoogleFetch tags the failure as a
        // GoogleFetchError (so it is not mistaken for a database problem); it still
        // propagates. Never return, swallow or add per-source fallbacks here.
        const [messages, files, cal] = await guardGoogleFetch(
          () =>
            Promise.all([
              listRecentMessages(session.accessToken, DEFAULT_MAX_PER_SOURCE),
              listRecentFiles(session.accessToken, DEFAULT_MAX_PER_SOURCE),
              listEventsWindow(session.accessToken),
            ]),
          GOOGLE_FETCH_TIMEOUT_MS,
        );
        return {
          gmail: messages.map(gmailMessageToBrainDocument),
          drive: files.map(driveFileToBrainDocument),
          calendar: cal.events.map(calendarEventToBrainDocument),
          calendarTruncated: cal.truncated,
        };
      },
    };

    const progress = phase === "embed" ? await runEmbedPhase(deps, undefined, undefined, undefined, requestStart) : await runFetchPhase(deps);
    return NextResponse.json(progress);
  } catch (err) {
    console.error("Ingestion sync failed", err);
    const message = syncErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
