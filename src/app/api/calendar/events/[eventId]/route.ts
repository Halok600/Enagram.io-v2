import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth-guard";
import { updateEvent, deleteEvent } from "@/lib/google/calendar";
import { triggerResync } from "@/lib/brain/trigger-resync";
import { isIngestionAvailable } from "@/lib/brain/ingest-tunnel";
import { friendlyGoogleErrorMessage } from "@/lib/google/friendly-error";

type RouteContext = { params: Promise<{ eventId: string }> };

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { eventId } = await params;
  const body = await req.json();
  const { summary, startDateTime, endDateTime, description, location, allDay } = body ?? {};

  try {
    const event = await updateEvent(session.accessToken, {
      eventId,
      summary,
      startDateTime,
      endDateTime,
      description,
      location,
      allDay,
    });
    triggerResync(new URL(req.url).origin, isIngestionAvailable(), req.headers.get("cookie"));
    return NextResponse.json({ event });
  } catch (err) {
    console.error("Calendar event update failed", err);
    return NextResponse.json(
      { error: friendlyGoogleErrorMessage(err) ?? "Failed to update calendar event" },
      { status: 500 },
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { eventId } = await params;

  try {
    await deleteEvent(session.accessToken, eventId);
    triggerResync(new URL(req.url).origin, isIngestionAvailable(), req.headers.get("cookie"));
    return NextResponse.json({ status: "deleted" });
  } catch (err) {
    console.error("Calendar event delete failed", err);
    return NextResponse.json(
      { error: friendlyGoogleErrorMessage(err) ?? "Failed to delete calendar event" },
      { status: 500 },
    );
  }
}
