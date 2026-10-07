/**
 * Standalone sync worker — the machine-side counterpart to
 * src/lib/brain/ingest-tunnel.ts. Runs wherever gbrain + the brain/ git repo
 * actually live (a Colab notebook, tunneled through ngrok, once the PC this
 * was built on gets reset). Reuses writeBrainPages/commitBrainRepo/syncBrain
 * unchanged — same code local dev already ran directly, just reachable over
 * HTTP now instead of called in-process by a Next.js route.
 *
 * Plain node:http rather than Bun.serve — same choice evals/run-evals.ts
 * already made, keeping this runnable under `bun run` without a Bun-specific
 * type dependency.
 *
 * Run with: bun run scripts/ingest-worker.ts
 * Requires INGEST_TUNNEL_SECRET set in the environment (same value as
 * Vercel's INGEST_TUNNEL_SECRET). Optional PORT (default 8787).
 */
import { createServer } from "node:http";
import { writeBrainPages } from "../src/lib/brain/write";
import { commitBrainRepo, syncBrain } from "../src/lib/brain/gbrain-cli";
import type { BrainDocument } from "../src/lib/brain/types";

const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.INGEST_TUNNEL_SECRET;
if (!SECRET) {
  throw new Error("INGEST_TUNNEL_SECRET must be set before starting the worker");
}

// gbrain's own embed step can take minutes (see JOURNAL.md); waiting past
// this just detaches from the response and lets it keep running in the
// background — it's already an in-flight promise on this long-lived
// process, so not awaiting it doesn't cancel it. Keeps the Vercel-side
// request (which does have a hard timeout) comfortably bounded.
const SYNC_WAIT_MS = 15_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | "timeout"> {
  return Promise.race([promise, new Promise<"timeout">((resolve) => setTimeout(() => resolve("timeout"), ms))]);
}

async function readJsonBody(req: import("node:http").IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return JSON.parse(Buffer.concat(chunks).toString("utf-8"));
}

const server = createServer(async (req, res) => {
  if (req.url !== "/sync" || req.method !== "POST") {
    res.writeHead(404).end("Not found");
    return;
  }

  if (req.headers.authorization !== `Bearer ${SECRET}`) {
    res.writeHead(401).end("Unauthorized");
    return;
  }

  let body: { docs: BrainDocument[]; commitMessage: string };
  try {
    body = (await readJsonBody(req)) as typeof body;
  } catch {
    res.writeHead(400, { "content-type": "application/json" }).end(JSON.stringify({ error: "Invalid JSON body" }));
    return;
  }

  console.log(`[${new Date().toISOString()}] sync request: ${body.docs?.length ?? 0} doc(s)`);

  try {
    const paths = await writeBrainPages(body.docs);
    const commit = await commitBrainRepo(body.commitMessage);

    const syncPromise = commit.committed ? syncBrain() : Promise.resolve({ skipped: false, log: "No changes to commit." });
    const syncResult = await withTimeout(syncPromise, SYNC_WAIT_MS);

    if (syncResult === "timeout") {
      console.log(`[${new Date().toISOString()}] embed step still running — backgrounded past ${SYNC_WAIT_MS}ms`);
      // Racing the timeout above doesn't cancel syncPromise — attach a
      // continuation now (fine to do after the race; it's still pending)
      // so the real outcome gets logged once it actually settles, instead
      // of the caller only ever seeing "still running."
      syncPromise
        .then((result) => {
          console.log(`[${new Date().toISOString()}] background sync settled — skipped=${result.skipped}`);
        })
        .catch((err) => {
          console.error(`[${new Date().toISOString()}] background sync failed`, err);
        });
      res.writeHead(200, { "content-type": "application/json" }).end(
        JSON.stringify({
          pagesWritten: paths.length,
          committed: commit.committed,
          indexing: "background",
          log: "gbrain sync is still running in the background — check the worker's console for the final result.",
        }),
      );
      return;
    }

    console.log(`[${new Date().toISOString()}] done — committed=${commit.committed} skipped=${syncResult.skipped}`);
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({
        pagesWritten: paths.length,
        committed: commit.committed,
        indexing: syncResult.skipped ? "skipped" : "completed",
        log: syncResult.log,
      }),
    );
  } catch (err) {
    console.error(`[${new Date().toISOString()}] sync failed`, err);
    res.writeHead(500, { "content-type": "application/json" }).end(
      JSON.stringify({ error: err instanceof Error ? err.message : "Sync failed" }),
    );
  }
});

server.listen(PORT, () => {
  console.log(`Ingest worker listening on :${PORT}`);
});
