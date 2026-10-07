import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { listEvents } from "@/lib/google/calendar";
import { friendlyGoogleErrorMessage } from "@/lib/google/friendly-error";
import { parseEventDate } from "@/lib/calendar-date";

/** Powers the sidebar's Calendar hover card — live data (not gbrain's
 * indexed snapshot), fetched on demand on hover, so it's always accurate
 * even if a sync hasn't run recently. */
export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const events = await listEvents(session.accessToken, {
      timeMin: startOfMonth.toISOString(),
      timeMax: endOfMonth.toISOString(),
      maxResults: 250,
    });

    const upcoming = events
      .filter((e) => parseEventDate(e.start).getTime() >= now.getTime())
      .slice(0, 3)
      .map((e) => ({ summary: e.summary, start: e.start, htmlLink: e.htmlLink }));

    return NextResponse.json({ eventCountThisMonth: events.length, upcoming });
  } catch (err) {
    console.error("Calendar summary failed", err);
    return NextResponse.json(
      { error: friendlyGoogleErrorMessage(err) ?? "Failed to load calendar summary" },
      { status: 500 },
    );
  }
}
