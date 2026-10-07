import { google, calendar_v3 } from "googleapis";
import { shiftDateOnly } from "@/lib/calendar-date";

export type CalendarEvent = {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string; // ISO 8601 (or YYYY-MM-DD, inclusive, for all-day events)
  end: string; // ISO 8601 (or YYYY-MM-DD, inclusive, for all-day events)
  isAllDay: boolean;
  attendees: string[];
  organizer: string;
  htmlLink: string;
};

function getClient(accessToken: string) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.calendar({ version: "v3", auth });
}

/**
 * Google's all-day `end.date` is EXCLUSIVE (one day past the last day of
 * the event) — every caller of this module (createEvent/updateEvent and
 * everything reading their return value) instead deals in an INCLUSIVE
 * last day, matching how a human describes "Aug 20 to Aug 22" and how
 * EventModal's two date pickers are labeled. This is the only place that
 * conversion happens, in both directions.
 */
function toCalendarEvent(event: calendar_v3.Schema$Event): CalendarEvent {
  const isAllDay = Boolean(event.start?.date && !event.start?.dateTime);
  const rawEnd = event.end?.dateTime ?? event.end?.date ?? "";
  return {
    id: event.id!,
    summary: event.summary || "(no title)",
    description: event.description ?? "",
    location: event.location ?? "",
    start: event.start?.dateTime ?? event.start?.date ?? "",
    end: isAllDay && rawEnd ? shiftDateOnly(rawEnd, -1) : rawEnd,
    isAllDay,
    attendees: (event.attendees ?? [])
      .map((a) => a.email)
      .filter((email): email is string => Boolean(email)),
    organizer: event.organizer?.email ?? "",
    htmlLink: event.htmlLink ?? "",
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Calendar has no natural "most recent N" like Gmail/Drive — events are
 * relative to now, not to when they were created/modified — so this windows
 * by time instead. Default window (ingestion, feature #5): 30 days back
 * (covers "what did I have last week") through 90 days forward (covers
 * "what's my next X"). singleEvents expands recurring events into
 * individual instances so each occurrence is its own searchable page
 * rather than one opaque recurrence rule.
 *
 * `timeMin`/`timeMax` are overridable (ISO 8601) so the /calendar page's
 * month/week navigation and the hover-card summary can request their own
 * exact range through this same function instead of three separate copies
 * of the same Calendar API call.
 */
export async function listEvents(
  accessToken: string,
  opts: { timeMin?: string; timeMax?: string; maxResults?: number } = {},
): Promise<CalendarEvent[]> {
  const calendar = getClient(accessToken);
  const now = Date.now();
  const {
    timeMin = new Date(now - 30 * DAY_MS).toISOString(),
    timeMax = new Date(now + 90 * DAY_MS).toISOString(),
    maxResults = 100,
  } = opts;

  const res = await calendar.events.list({
    calendarId: "primary",
    timeMin,
    timeMax,
    maxResults,
    singleEvents: true,
    orderBy: "startTime",
  });

  return (res.data.items ?? [])
    .filter((e) => e.status !== "cancelled")
    .map(toCalendarEvent);
}

/**
 * Personal events only — no `attendees` field anywhere in this file's
 * write path. Google Calendar sends real invite emails the moment an
 * event with attendees is created/updated, the same class of
 * "sends something to a real third party" risk this app deliberately
 * avoids for Gmail (drafts are never auto-sent). Confirmed with the user
 * (2026-08-10) before building this: these tools only ever touch the
 * user's own calendar.
 */
export async function createEvent(
  accessToken: string,
  { summary, startDateTime, endDateTime, description, location, allDay }: {
    summary: string;
    startDateTime: string;
    endDateTime: string;
    description?: string;
    location?: string;
    /** When true, startDateTime/endDateTime are "YYYY-MM-DD" (inclusive last day), not ISO datetimes. */
    allDay?: boolean;
  },
): Promise<CalendarEvent> {
  const calendar = getClient(accessToken);
  const res = await calendar.events.insert({
    calendarId: "primary",
    requestBody: {
      summary,
      description,
      location,
      start: allDay ? { date: startDateTime } : { dateTime: startDateTime },
      end: allDay ? { date: shiftDateOnly(endDateTime, 1) } : { dateTime: endDateTime },
    },
  });
  return toCalendarEvent(res.data);
}

export async function updateEvent(
  accessToken: string,
  { eventId, summary, startDateTime, endDateTime, description, location, allDay }: {
    eventId: string;
    summary?: string;
    startDateTime?: string;
    endDateTime?: string;
    description?: string;
    location?: string;
    /** When true, startDateTime/endDateTime are "YYYY-MM-DD" (inclusive last day), not ISO datetimes. */
    allDay?: boolean;
  },
): Promise<CalendarEvent> {
  const calendar = getClient(accessToken);
  const res = await calendar.events.patch({
    calendarId: "primary",
    eventId,
    requestBody: {
      ...(summary !== undefined ? { summary } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(startDateTime !== undefined
        ? { start: allDay ? { date: startDateTime } : { dateTime: startDateTime } }
        : {}),
      ...(endDateTime !== undefined
        ? { end: allDay ? { date: shiftDateOnly(endDateTime, 1) } : { dateTime: endDateTime } }
        : {}),
    },
  });
  return toCalendarEvent(res.data);
}

export async function deleteEvent(accessToken: string, eventId: string): Promise<void> {
  const calendar = getClient(accessToken);
  await calendar.events.delete({ calendarId: "primary", eventId });
}
