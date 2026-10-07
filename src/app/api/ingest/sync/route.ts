import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { listRecentMessages } from "@/lib/google/gmail";
import { listRecentFiles } from "@/lib/google/drive";
import { listEvents } from "@/lib/google/calendar";
import {
  gmailMessageToBrainDocument,
  driveFileToBrainDocument,
  calendarEventToBrainDocument,
} from "@/lib/brain/normalize";
import { writeBrainPages } from "@/lib/brain/write";
import { brainDocumentPagePath } from "@/lib/brain/markdown";
import { commitBrainRepo, syncBrain } from "@/lib/brain/gbrain-cli";
import { linkRelatedDocuments } from "@/lib/brain/gbrain-remote";
import { getTunnelConfig, syncViaTunnel } from "@/lib/brain/ingest-tunnel";

// Was 50 — raised alongside gmail.ts's Promotions/Social filter after a
// live case (2026-08-18) where a real, important thread from the day
// before fell outside the unfiltered top-50-across-all-mail window. The
// filter alone reclaims most of the lost headroom; this is extra margin
// on top of it, not a replacement for it.
const DEFAULT_MAX_PER_SOURCE = 100;

export async function POST() {
  // Ingestion needs a local gbrain binary + local brain/ git repo — neither
  // exists on Vercel's serverless functions. If INGEST_TUNNEL_URL is set,
  // proxy the write+sync step to a standalone worker (scripts/ingest-worker.ts)
  // running wherever those actually live instead — see ingest-tunnel.ts. The
  // UI hides the re-sync button when neither path is available (see
  // page.tsx's isIngestionAvailable()), but guard the route itself too.
  const tunnel = getTunnelConfig();
  if (process.env.VERCEL && !tunnel) {
    return NextResponse.json(
      { error: "Ingestion only runs from local dev — this deployment reads the same shared brain." },
      { status: 501 },
    );
  }

  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const [messages, files, events] = await Promise.all([
      listRecentMessages(session.accessToken, DEFAULT_MAX_PER_SOURCE),
      listRecentFiles(session.accessToken, DEFAULT_MAX_PER_SOURCE),
      listEvents(session.accessToken),
    ]);

    const docs = [
      ...messages.map(gmailMessageToBrainDocument),
      ...files.map(driveFileToBrainDocument),
      ...events.map(calendarEventToBrainDocument),
    ];

    const commitMessage = `ingest: ${messages.length} gmail message(s), ${files.length} drive file(s), ${events.length} calendar event(s)`;

    const { pagesWritten, committed, indexing, log } = tunnel
      ? await syncViaTunnel(docs, commitMessage)
      : await (async () => {
          const paths = await writeBrainPages(docs);
          const commit = await commitBrainRepo(commitMessage);
          const sync = await syncBrain();
          return {
            pagesWritten: paths.length,
            committed: commit.committed,
            indexing: (sync.skipped ? "skipped" : "completed") as "skipped" | "completed",
            log: sync.log,
          };
        })();

    // Only worth relinking when something actually changed — most auto-syncs
    // (feature #3, fires on every page load) find nothing new, and linking
    // is a sequential write burst against the remote server that shouldn't
    // run on every no-op sync.
    const linking = committed
      ? await linkRelatedDocuments(
          docs.map((doc) => ({
            slug: brainDocumentPagePath(doc).replace(/\.md$/, ""),
            source: doc.source,
            participants: doc.participants,
          })),
          session.user?.email ?? "",
        )
      : { linksCreated: 0, linksAttempted: 0 };

    return NextResponse.json({
      gmailCount: messages.length,
      driveCount: files.length,
      calendarCount: events.length,
      pagesWritten,
      committed,
      linksCreated: linking.linksCreated,
      indexing,
      syncLog: log,
    });
  } catch (err) {
    console.error("Ingestion sync failed", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingestion sync failed" },
      { status: 500 },
    );
  }
}
