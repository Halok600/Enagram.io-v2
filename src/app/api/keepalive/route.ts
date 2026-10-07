import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/cron-auth";
import { pingBrain } from "@/lib/brain/gbrain-remote";

// Matches pingBrain's 50s timeout — a cold Render instance can take most of a
// minute to wake, and the whole point is to reach Supabase through it.
export const maxDuration = 60;

/**
 * Daily Vercel Cron target (see vercel.json). Keeps the free-tier Supabase
 * project from auto-pausing after ~7 idle days, which silently takes the whole
 * app down. Not session-authenticated (cron has no user); guarded by
 * CRON_SECRET instead.
 */
export async function GET(req: Request) {
  if (!isAuthorizedCron(req.headers.get("authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await pingBrain());
  } catch (err) {
    console.error("Keepalive ping failed", err);
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Keepalive ping failed" },
      { status: 502 },
    );
  }
}
