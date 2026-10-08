import { NextResponse } from "next/server";
import { describeDbError } from "@/lib/db-errors";
import { checkHealth } from "@/lib/store/health";
import { getDb } from "@/lib/store/service";

export const dynamic = "force-dynamic";
// The DB connect_timeout is 15s; leave room for the fallback path.
export const maxDuration = 30;

/**
 * Public on purpose: uptime checks, the GitHub heartbeat and the in-app banner
 * call it. It returns only a status, a document count and the last sync time,
 * makes no Gemini or Google calls (so it cannot be used to burn quota), and
 * exposes a coarse reason, never error text. It runs a real `select 1`, which
 * is also what keeps a free-tier Supabase project from pausing.
 */
export async function GET() {
  try {
    const db = await getDb();
    return NextResponse.json({ db: "ok", ...(await checkHealth(db)) });
  } catch (err) {
    console.error("Health check failed", err);
    return NextResponse.json({ db: "down", reason: describeDbError(err).kind }, { status: 503 });
  }
}
