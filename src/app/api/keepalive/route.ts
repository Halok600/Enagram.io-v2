import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { describeDbError } from "@/lib/db-errors";
import { checkHealth } from "@/lib/store/health";
import { getDb } from "@/lib/store/service";

export const maxDuration = 60;

/**
 * Daily Vercel Cron target (see vercel.json). A real query keeps the free-tier
 * Supabase project from auto-pausing after ~7 idle days, which silently took
 * the v1 app down. Not session-authenticated (cron has no user); guarded by
 * CRON_SECRET and fails closed when it is unset.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({ ok: true, ...(await checkHealth(await getDb())) });
  } catch (err) {
    console.error("Keepalive failed", err);
    return NextResponse.json({ ok: false, error: describeDbError(err).message }, { status: 502 });
  }
}
