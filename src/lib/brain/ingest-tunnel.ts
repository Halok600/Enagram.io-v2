import type { BrainDocument } from "./types";

/**
 * PC-reset architecture (see JOURNAL.md): local dev's brain/ git repo + local
 * gbrain binary don't exist on Vercel, so on Vercel ingestion instead proxies
 * to a small standalone worker (scripts/ingest-worker.ts) running on whatever
 * machine currently has them installed — a Colab notebook tunneled through
 * ngrok, restarted by hand, its URL re-pasted into INGEST_TUNNEL_URL each
 * time. Colab is a persistent machine, not a serverless function, so it can
 * run git commit + gbrain sync and take as long as it needs — nothing about
 * Vercel's 60s function cap applies to that step anymore, unlike the earlier
 * per-document-remote-write design this replaced.
 */
export type TunnelConfig = { url: string; secret: string };

export function getTunnelConfig(): TunnelConfig | null {
  const url = process.env.INGEST_TUNNEL_URL;
  const secret = process.env.INGEST_TUNNEL_SECRET;
  if (!url || !secret) return null;
  // A trailing slash (easy to paste by accident — browsers show bare origins
  // that way) would otherwise become a double slash below (".../app//sync"),
  // which ngrok's edge can reject with its own branded 404 before the
  // request ever reaches the worker — confirmed live 2026-08-19.
  return { url: url.replace(/\/+$/, ""), secret };
}

/** Single source of truth for the UI gate — replaces the raw !process.env.VERCEL check. */
export function isIngestionAvailable(): boolean {
  return !process.env.VERCEL || getTunnelConfig() !== null;
}

export type TunnelSyncResult = {
  pagesWritten: number;
  committed: boolean;
  indexing: "completed" | "background" | "skipped";
  log: string;
};

const TUNNEL_TIMEOUT_MS = 20_000;

/**
 * Proxies a sync request to the worker over the ngrok tunnel. The
 * ngrok-skip-browser-warning header is required: ngrok's free tier serves an
 * HTML interstitial to anonymous requests otherwise, and a server-to-server
 * fetch would get that HTML back instead of JSON.
 */
export async function syncViaTunnel(
  docs: BrainDocument[],
  commitMessage: string,
): Promise<TunnelSyncResult> {
  const config = getTunnelConfig();
  if (!config) throw new Error("Ingestion tunnel is not configured");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TUNNEL_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(`${config.url}/sync`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.secret}`,
        "Content-Type": "application/json",
        "ngrok-skip-browser-warning": "true",
      },
      body: JSON.stringify({ docs, commitMessage }),
      signal: controller.signal,
    });
  } catch {
    throw new Error("Sync worker unreachable — is the Colab notebook running?");
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Sync worker returned HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  return (await res.json()) as TunnelSyncResult;
}
