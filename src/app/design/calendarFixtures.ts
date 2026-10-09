import type { CalendarEventDTO } from "../calendar/EventModal";

// Generic fixture events for the development-only /design calendar views. No personal data. The ids are chosen so
// that eventColor(id) gives each of the three colours (the comments name it).

type Spec = {
  id: string;
  title: string;
  hour: number;
  minute: number;
  minutes: number;
  location?: string;
  description?: string;
  allDay?: boolean;
};

const pad = (n: number) => String(n).padStart(2, "0");
const dateOnly = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function build(day: Date, spec: Spec): CalendarEventDTO {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), spec.hour, spec.minute);
  const end = new Date(start.getTime() + spec.minutes * 60_000);
  return {
    id: spec.id,
    summary: spec.title,
    description: spec.description ?? "",
    location: spec.location ?? "",
    start: spec.allDay ? dateOnly(day) : start.toISOString(),
    end: spec.allDay ? dateOnly(day) : end.toISOString(),
    isAllDay: Boolean(spec.allDay),
    htmlLink: `https://example.com/calendar/${spec.id}`,
  };
}

// [day of the month, event]. A day past the end of a short month is clamped to its last day.
const MONTH: [number, Spec][] = [
  [2, { id: "fx-standup", title: "Team stand-up", hour: 9, minute: 30, minutes: 30, location: "Room 4" }], // cobalt
  [3, { id: "fx-design", title: "Design review", hour: 14, minute: 0, minutes: 90 }], // sun
  [6, { id: "fx-dentist", title: "Dentist", hour: 8, minute: 15, minutes: 60, location: "Elm Street Clinic" }], // bubblegum
  [7, { id: "fx-gym", title: "Gym", hour: 18, minute: 0, minutes: 60 }], // cobalt
  [12, { id: "fx-planning", title: "Quarterly planning workshop", hour: 10, minute: 0, minutes: 180, location: "Main hall" }], // bubblegum
  [14, { id: "fx-travel", title: "Airport transfer", hour: 7, minute: 0, minutes: 45 }], // cobalt
  [14, { id: "fx-lunch", title: "Lunch with the team", hour: 12, minute: 0, minutes: 60, location: "The Corner Cafe" }], // sun
  [14, { id: "fx-review", title: "Budget review", hour: 15, minute: 30, minutes: 60 }], // sun
  [14, { id: "fx-party", title: "Team dinner", hour: 19, minute: 0, minutes: 120, location: "Harbour Grill" }], // bubblegum
  [14, { id: "fx-demo", title: "Demo prep", hour: 17, minute: 0, minutes: 30 }], // sun
  [16, { id: "fx-offsite", title: "Company offsite", hour: 0, minutes: 0, minute: 0, allDay: true, location: "Lakeside Lodge" }], // sun
  [20, {
    id: "fx-launch",
    title: "Launch readiness review with the infrastructure, support and customer success teams (extended session)",
    hour: 11,
    minute: 0,
    minutes: 120,
    location: "Conference room B, second floor, west wing",
    description: "Walk through the launch checklist, open risks and the rollback plan. Bring the latest numbers.",
  }], // bubblegum
  [22, { id: "fx-focus", title: "Focus time", hour: 9, minute: 0, minutes: 120 }], // sun
  [22, { id: "fx-coffee", title: "Coffee chat", hour: 15, minute: 0, minutes: 30 }], // sun
  [27, { id: "fx-book", title: "Book club", hour: 20, minute: 0, minutes: 90 }], // sun
];

// [days from today, event]: these keep the week around today busy whatever today is.
const AROUND_TODAY: [number, Spec][] = [
  [-3, { id: "fx-1on1", title: "One-on-one", hour: 11, minute: 0, minutes: 30, location: "Cafe" }], // sun
  [-2, { id: "fx-sync", title: "Vendor sync", hour: 13, minute: 30, minutes: 60 }], // sun
  [-1, { id: "fx-retro", title: "Sprint retro", hour: 16, minute: 0, minutes: 60, location: "Room 2" }], // sun
  [0, { id: "fx-gym2", title: "Morning run", hour: 7, minute: 0, minutes: 45 }],
  [0, { id: "fx-dentist2", title: "Pick up the keys", hour: 12, minute: 15, minutes: 30, location: "Front desk" }],
  [1, { id: "fx-planning2", title: "Roadmap planning", hour: 10, minute: 0, minutes: 120, location: "Main hall", description: "Pick the three bets for next quarter." }],
];

/** Fixture events for the month of `now`, plus a few around today. Ids are stable across calls. */
export function calendarFixtureEvents(now: Date): CalendarEventDTO[] {
  const y = now.getFullYear();
  const m = now.getMonth();
  const length = new Date(y, m + 1, 0).getDate();
  const out: CalendarEventDTO[] = [];
  for (const [d, spec] of MONTH) out.push(build(new Date(y, m, Math.min(d, length)), spec));
  for (const [offset, spec] of AROUND_TODAY) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    if (day.getMonth() === m) out.push(build(day, spec));
  }
  return out;
}

/** The single event the editor views show. */
export function calendarFixtureEvent(now: Date): CalendarEventDTO {
  const day = new Date(now.getFullYear(), now.getMonth(), Math.min(12, new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()));
  return build(day, {
    id: "fx-planning",
    title: "Quarterly planning workshop",
    hour: 10,
    minute: 0,
    minutes: 180,
    location: "Main hall, first floor",
    description: "Agree the three priorities for next quarter and who owns each one.",
  });
}

/**
 * Replaces window.fetch with a stub that answers the calendar API and /api/health from the fixtures (and passes
 * everything else through). Returns the function that puts the original back. Used only by the calendar views of
 * the preview, so the real board runs with no sign-in, database or Google account.
 */
export function installCalendarFetchStub(options: { empty?: boolean; hang?: boolean } = {}): () => void {
  const original = window.fetch;
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    if (url.startsWith("/api/calendar/events")) {
      if (method !== "GET") return Promise.resolve(json({ ok: true }));
      if (options.hang) return new Promise<Response>(() => {}); // never answers: the loading state
      return Promise.resolve(json({ events: options.empty ? [] : calendarFixtureEvents(new Date()) }));
    }
    if (url.startsWith("/api/health")) return Promise.resolve(json({ db: "ok", documents: 163 }));
    return original(input, init);
  };
  return () => {
    window.fetch = original;
  };
}
