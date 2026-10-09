"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { motion, useReducedMotion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, MapPin, Plus } from "lucide-react";
import { EventModal, type CalendarEventDTO } from "./EventModal";
import { parseEventDate, shiftDateOnly } from "@/lib/calendar-date";
import { eventColor } from "@/lib/ui/event-color";
import { selectTapeItems } from "@/lib/ui/tape";
import { Card } from "../ui/Card";
import { Stamp } from "../ui/Stamp";
import { StickerButton } from "../ui/StickerButton";
import { TapeSlot } from "../ui/TapeSlot";
import { TONE_CLASS } from "../ui/tone";
import { TopBar } from "../ui/TopBar";
import { useHealth } from "../useHealth";
import { useSync } from "../useSync";

type ViewMode = "month" | "week";
type ModalState = { mode: "create"; date: Date } | { mode: "view" | "edit"; event: CalendarEventDTO } | null;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Presentation only: below Tailwind's md breakpoint (48rem) a tap on a day selects it instead of opening the
// editor. Read with useSyncExternalStore (no setState in an effect); the server snapshot is "not small", and the
// layout itself is pure CSS, so only the click behaviour waits for hydration.
const SMALL_SCREEN_QUERY = "(width < 48rem)";
function subscribeSmallScreen(onChange: () => void) {
  const mq = window.matchMedia(SMALL_SCREEN_QUERY);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
const getSmallScreen = () => window.matchMedia(SMALL_SCREEN_QUERY).matches;
const getSmallScreenOnServer = () => false;

function timeOnly(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
/** "9:00 AM" for a timed event, null for an all-day one. */
function startLabel(event: CalendarEventDTO): string | null {
  return event.isAllDay ? null : timeOnly(parseEventDate(event.start));
}
/** "9:00 AM – 10:30 AM" for a timed event, "All day" otherwise. */
function rangeLabel(event: CalendarEventDTO): string {
  return event.isAllDay ? "All day" : `${timeOnly(parseEventDate(event.start))} – ${timeOnly(parseEventDate(event.end))}`;
}

function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return addDays(d, -d.getDay());
}
function startOfMonthGrid(date: Date): Date {
  const firstOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  return startOfWeek(firstOfMonth);
}
function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function sameMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}
function isToday(date: Date): boolean {
  return dateKey(date) === dateKey(new Date());
}

const MONTH_GRID_WEEKS = 6;

export function CalendarBoard({ email }: { email: string }) {
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const requestIdRef = useRef(0);

  // Presentation-only state: the shared top bar's data, the small-screen selected day (the last tapped day,
  // today until one is tapped) and the day currently under a dragged event (for the dashed drop outline).
  const health = useHealth();
  const sync = useSync();
  const tapeItems = selectTapeItems({ dbMessage: health.dbMessage, chatError: null, sync });
  const reduceMotion = useReducedMotion();
  const isSmallScreen = useSyncExternalStore(subscribeSmallScreen, getSmallScreen, getSmallScreenOnServer);
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [dropKey, setDropKey] = useState<string | null>(null);
  const [loadedRange, setLoadedRange] = useState<{ start: number; end: number } | null>(null);

  const gridStart = useMemo(
    () => (viewMode === "month" ? startOfMonthGrid(cursor) : startOfWeek(cursor)),
    [viewMode, cursor],
  );
  const gridDays = viewMode === "month" ? MONTH_GRID_WEEKS * 7 : 7;
  const gridEnd = useMemo(() => addDays(gridStart, gridDays), [gridStart, gridDays]);

  // Deliberately NOT async/await: this project's lint config flags any
  // setState reachable synchronously from an effect body. An
  // async function's statements before its first `await` still run
  // synchronously when invoked, so `setLoading(true)` as the first line of
  // an async fetchEvents would trip the same rule. Structuring this as a
  // plain function whose only synchronous statement is the fetch() call
  // itself — every setState happens inside a later .then() callback,
  // never synchronously in the effect's call stack — sidesteps it cleanly,
  // the same pattern the rest of the app uses.
  // Guarded by a monotonic request id rather than a single per-effect
  // `cancelled` flag because fetchEvents
  // is called from multiple places — the range-change effect below, but
  // also EventModal's onSaved and handleDrop's post-reschedule refresh —
  // so a stale in-flight response needs to be ignorable no matter which
  // caller's request it belongs to, not just superseded effect runs.
  // Tracks the range covered by the most recent successful fetch, so
  // toggling month -> week (or back) at the same cursor — always a subset
  // of the month grid already in `events` — can reuse it instead of firing
  // a redundant network round-trip. Only read/written here; callers that
  // need to force a real refetch (EventModal's onSaved, handleDrop) call
  // fetchEvents() directly, bypassing this range check entirely.
  const fetchedRangeRef = useRef<{ start: number; end: number } | null>(null);

  const fetchEvents = useCallback(() => {
    const requestId = ++requestIdRef.current;
    fetch(
      `/api/calendar/events?start=${encodeURIComponent(gridStart.toISOString())}&end=${encodeURIComponent(gridEnd.toISOString())}`,
    )
      .then((res) => res.json().then((data) => ({ ok: res.ok, data })))
      .then(({ ok, data }) => {
        if (requestId !== requestIdRef.current) return;
        if (ok) {
          setEvents(data.events ?? []);
          fetchedRangeRef.current = { start: gridStart.getTime(), end: gridEnd.getTime() };
        }
        setLoading(false);
      })
      .catch((err) => {
        if (requestId !== requestIdRef.current) return;
        console.error("Failed to load calendar events", err);
        setLoading(false);
      });
  }, [gridStart, gridEnd]);

  useEffect(() => {
    // `fetchedRangeRef` is only ever populated inside fetchEvents' own
    // success callback, so by the time it's covered here `loading` was
    // already set to false when that earlier fetch completed — nothing
    // left to update for this narrower, already-covered range.
    const covered = fetchedRangeRef.current;
    if (covered && gridStart.getTime() >= covered.start && gridEnd.getTime() <= covered.end) {
      return;
    }
    fetchEvents();
  }, [fetchEvents, gridStart, gridEnd]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEventDTO[]>();
    for (const event of events) {
      const key = dateKey(parseEventDate(event.start));
      const list = map.get(key) ?? [];
      list.push(event);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort((a, b) => parseEventDate(a.start).getTime() - parseEventDate(b.start).getTime());
    }
    return map;
  }, [events]);

  // Presentation only: mirrors the range cache (fetchedRangeRef, read-only here) into state for the empty note.
  // Every successful fetch sets a new `events` array, and the ref is written in the same callback, so reading it
  // after this commit is current. Read in a promise callback, never synchronously in the effect body (lint rule).
  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (!cancelled) setLoadedRange(fetchedRangeRef.current);
    });
    return () => {
      cancelled = true;
    };
  }, [events]);

  function navigate(direction: -1 | 1) {
    setCursor((prev) => (viewMode === "month" ? addMonths(prev, direction) : addDays(prev, direction * 7)));
  }

  async function handleDrop(event: CalendarEventDTO, targetDate: Date) {
    const originalStart = parseEventDate(event.start);
    const dayDelta = Math.round((startOfDayMs(targetDate) - startOfDayMs(originalStart)) / (24 * 60 * 60 * 1000));
    if (dayDelta === 0) return;

    const body = event.isAllDay
      ? {
          allDay: true,
          startDateTime: shiftDateOnly(event.start, dayDelta),
          endDateTime: shiftDateOnly(event.end, dayDelta),
        }
      : {
          startDateTime: addDays(originalStart, dayDelta).toISOString(),
          endDateTime: addDays(parseEventDate(event.end), dayDelta).toISOString(),
        };

    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) void fetchEvents();
    } catch (err) {
      console.error("Failed to reschedule event", err);
    }
  }

  function handleChipDragEnd(event: CalendarEventDTO, info: PanInfo) {
    for (const [key, el] of cellRefs.current) {
      const rect = el.getBoundingClientRect();
      if (
        info.point.x >= rect.left &&
        info.point.x <= rect.right &&
        info.point.y >= rect.top &&
        info.point.y <= rect.bottom
      ) {
        const [y, m, d] = key.split("-").map(Number);
        void handleDrop(event, new Date(y, m - 1, d));
        return;
      }
    }
  }

  // Presentation only: which day cell is under the pointer while an event is dragged (the drop-target outline).
  // Same hit test as handleChipDragEnd; the day the event already sits on is not a target, since dropping there
  // changes nothing.
  function cellKeyAt(point: { x: number; y: number }): string | null {
    for (const [key, el] of cellRefs.current) {
      const rect = el.getBoundingClientRect();
      if (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom) return key;
    }
    return null;
  }

  const days = Array.from({ length: gridDays }, (_, i) => addDays(gridStart, i));

  const visibleCount = days.reduce((n, day) => n + (eventsByDay.get(dateKey(day))?.length ?? 0), 0);
  // The "nothing on..." note needs the answer to be in: the last successful fetch must cover the visible grid
  // (`loadedRange`, see the effect below). A failed load never changes it, so the note stays hidden after a
  // failure, and while a new range is still loading it stays hidden too (no flash of "nothing" between pages).
  const rangeLoaded =
    loadedRange !== null && gridStart.getTime() >= loadedRange.start && gridEnd.getTime() <= loadedRange.end;
  // The small-screen selected day only counts while it is inside the visible grid; after paging to another
  // month the list falls back to the day the cursor is on, so it never shows a day whose events are not loaded.
  const selectedKey = days.some((d) => dateKey(d) === dateKey(selectedDay)) ? dateKey(selectedDay) : dateKey(cursor);
  const shownDay = days.find((d) => dateKey(d) === selectedKey) ?? cursor;
  const shownDayEvents = eventsByDay.get(selectedKey) ?? [];

  const monthName = cursor.toLocaleDateString([], { month: "long" });
  const year = cursor.getFullYear();

  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden">
      <TopBar
        email={email}
        documents={health.view.documents}
        sync={{ state: sync.state, run: () => void sync.run() }}
        variant="calendar"
      />
      <TapeSlot items={tapeItems} />

      <main className="flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-3 pt-5 pb-8 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <h1 className="flex min-w-0 flex-wrap items-baseline gap-x-4">
            <span className="font-display text-[clamp(3rem,10vw,7rem)] [overflow-wrap:anywhere]">{monthName}</span>{" "}
            <span className="font-hand text-3xl text-[var(--ink-soft)] md:text-4xl motion-safe:-rotate-2">{year}</span>
          </h1>

          <div className="flex flex-wrap items-center gap-3">
            <StickerButton aria-label="Previous" onClick={() => navigate(-1)} className="min-w-11 px-0!">
              <ChevronLeft aria-hidden size={20} strokeWidth={3} />
            </StickerButton>
            <StickerButton aria-label="Next" onClick={() => navigate(1)} className="min-w-11 px-0!">
              <ChevronRight aria-hidden size={20} strokeWidth={3} />
            </StickerButton>
            <StickerButton onClick={() => setCursor(new Date())}>TODAY</StickerButton>

            <div role="group" aria-label="Calendar view" className="flex gap-2">
              {(["month", "week"] as const).map((mode) => {
                const active = viewMode === mode;
                return (
                  <StickerButton
                    key={mode}
                    tone={active ? "cobalt" : "plain"}
                    aria-pressed={active}
                    onClick={() => setViewMode(mode)}
                    // The active sticker sits pressed into its shadow: a 1px shadow, shifted down and right.
                    className={active ? "relative top-[3px] left-[3px] [--elevation:var(--shadow-hard-sm)]" : ""}
                  >
                    {mode.toUpperCase()}
                  </StickerButton>
                );
              })}
            </div>

            <StickerButton tone="sun" onClick={() => setModal({ mode: "create", date: new Date() })}>
              <Plus aria-hidden size={18} strokeWidth={3} />
              NEW EVENT
            </StickerButton>
          </div>
        </div>

        {!loading && rangeLoaded && visibleCount === 0 && (
          <p className="font-hand text-3xl text-[var(--ink-soft)] md:text-4xl">nothing on... suspicious.</p>
        )}

        <section
          aria-label={viewMode === "month" ? "Month view" : "Week view"}
          className="elev relative shrink-0 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--panel)] [--elevation:var(--shadow-hard)]"
        >
          {/* The loading strip: hazard tape while the first fetch is in flight, the plain ink band afterwards, so
              nothing shifts when it ends. */}
          <div role="status" className={`h-3 ${loading ? "hazard" : "bg-[var(--ink)]"}`}>
            <span className="sr-only">{loading ? "Loading events…" : ""}</span>
          </div>

          {viewMode === "month" ? (
            <>
              <div className="grid grid-cols-7 bg-[var(--ink)] text-[var(--bg)]">
                {WEEKDAY_LABELS.map((label) => (
                  <div key={label} className="font-display py-2 text-center text-[0.7rem] md:text-sm">
                    {label}
                  </div>
                ))}
              </div>

              <div className="grid auto-rows-[minmax(3.75rem,auto)] grid-cols-7 md:auto-rows-[minmax(6.5rem,auto)] [&>*:nth-child(7n)]:border-r-0 [&>*:nth-last-child(-n+7)]:border-b-0">
                {days.map((day) => {
                  const key = dateKey(day);
                  const dayEvents = eventsByDay.get(key) ?? [];
                  const visible = dayEvents.slice(0, 3);
                  const overflow = dayEvents.length - visible.length;
                  const today = isToday(day);
                  const selected = key === selectedKey;

                  return (
                    <div
                      key={key}
                      ref={(el) => {
                        if (el) cellRefs.current.set(key, el);
                        else cellRefs.current.delete(key);
                      }}
                      onClick={() => (isSmallScreen ? setSelectedDay(day) : setModal({ mode: "create", date: day }))}
                      className={`relative flex cursor-pointer flex-col gap-1 border-r-[length:var(--stroke)] border-b-[length:var(--stroke)] border-[var(--line)] p-1 md:p-1.5 ${
                        sameMonth(day, cursor) ? "" : "opacity-40"
                      } ${
                        dropKey === key
                          ? "bg-[color-mix(in_srgb,var(--sun)_28%,transparent)] outline-3 -outline-offset-3 outline-[color:var(--sun)] outline-dashed"
                          : ""
                      } ${selected ? "max-md:bg-[color-mix(in_srgb,var(--sun)_28%,transparent)] max-md:outline-3 max-md:-outline-offset-3 max-md:outline-[color:var(--ink)]" : ""}`}
                    >
                      {today ? (
                        <>
                          <Stamp tone="cobalt" className="w-fit max-md:hidden">
                            TODAY {day.getDate()}
                          </Stamp>
                          <span className="font-display grid h-7 w-7 place-items-center rounded-full border-[length:var(--stroke)] border-[var(--line)] bg-[var(--cobalt)] text-xs text-[var(--on-cobalt)] md:hidden">
                            {day.getDate()}
                          </span>
                        </>
                      ) : (
                        <span className="w-fit px-1 text-sm font-bold">{day.getDate()}</span>
                      )}

                      {/* From md up: thin colour bars, draggable (the existing drag and drop). */}
                      {visible.map((event) => {
                        const start = startLabel(event);
                        return (
                          <motion.div
                            key={event.id}
                            drag
                            dragSnapToOrigin
                            dragMomentum={false}
                            whileDrag={{
                              scale: 1.05,
                              zIndex: 50,
                              boxShadow: "var(--shadow-hard-lg)",
                              ...(reduceMotion ? {} : { rotate: 2 }),
                            }}
                            onDrag={(_, info) => {
                              const target = cellKeyAt(info.point);
                              setDropKey(target === dateKey(parseEventDate(event.start)) ? null : target);
                            }}
                            onDragEnd={(_, info) => {
                              setDropKey(null);
                              handleChipDragEnd(event, info);
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setModal({ mode: "view", event });
                            }}
                            title={event.summary}
                            className={`elev cursor-grab truncate rounded-[2px] border-[length:var(--stroke)] border-[var(--line)] px-1.5 text-xs leading-5 [--elevation:var(--shadow-hard-sm)] max-md:hidden ${TONE_CLASS[eventColor(event.id)]}`}
                          >
                            {start && <span className="mr-1 font-bold">{start}</span>}
                            {event.summary}
                          </motion.div>
                        );
                      })}
                      {overflow > 0 && (
                        <span className="font-display w-fit rounded-[2px] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--ink)] px-1.5 py-0.5 text-[0.65rem] text-[var(--bg)] max-md:hidden">
                          +{overflow} MORE
                        </span>
                      )}

                      {/* Below md: one coloured dot per event (up to four) instead of the bars. */}
                      {dayEvents.length > 0 && (
                        <div className="flex flex-wrap gap-1 px-0.5 md:hidden">
                          {dayEvents.slice(0, 4).map((event) => (
                            <span
                              key={event.id}
                              aria-hidden
                              className={`h-2.5 w-2.5 rounded-full border-2 border-[var(--line)] ${TONE_CLASS[eventColor(event.id)]}`}
                            />
                          ))}
                          <span className="sr-only">{dayEvents.length} events</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 gap-3 p-3 md:grid-cols-7">
              {days.map((day) => {
                const key = dateKey(day);
                const dayEvents = eventsByDay.get(key) ?? [];
                const today = isToday(day);

                return (
                  <div key={key} className="flex min-w-0 flex-col gap-2">
                    <Card
                      shadow="sm"
                      tone={today ? "cobalt" : "panel"}
                      className="flex items-baseline justify-between gap-2 px-3 py-2 md:flex-col md:items-start md:justify-start"
                    >
                      <span className="font-display text-xs">{WEEKDAY_LABELS[day.getDay()]}</span>
                      <span className="font-display text-2xl">{day.getDate()}</span>
                      {today && <span className="sr-only">Today</span>}
                    </Card>
                    <div className="flex flex-1 flex-col gap-2 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--bg)] p-2 md:min-h-[26rem]">
                      {dayEvents.map((event) => (
                        <button
                          key={event.id}
                          type="button"
                          onClick={() => setModal({ mode: "view", event })}
                          className={`elev flex w-full min-w-0 cursor-pointer flex-col gap-1 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] p-2 text-left [--elevation:var(--shadow-hard-sm)] ${TONE_CLASS[eventColor(event.id)]}`}
                        >
                          <span className="font-display text-[0.65rem]">{rangeLabel(event)}</span>
                          <span className="line-clamp-3 text-sm font-bold [overflow-wrap:anywhere]">{event.summary}</span>
                          {event.location && (
                            <span className="flex min-w-0 items-center gap-1 text-xs">
                              <MapPin aria-hidden size={12} strokeWidth={3} className="shrink-0" />
                              <span className="truncate">{event.location}</span>
                            </span>
                          )}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => setModal({ mode: "create", date: day })}
                        className="font-display mt-auto min-h-11 cursor-pointer rounded-[var(--radius-card)] border-[length:var(--stroke)] border-dashed border-[var(--ink-soft)] px-2 text-xs text-[var(--ink-soft)] hover:border-[var(--ink)] hover:text-[var(--ink)]"
                      >
                        + ADD
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Small screens, month view: the selected day's events as sticker cards under the grid. */}
        {viewMode === "month" && (
          <section aria-label="Selected day" className="flex flex-col gap-4 md:hidden">
            <div className="flex items-end justify-between gap-3">
              <h2 className="font-display text-3xl">
                {shownDay.toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
              </h2>
              <StickerButton onClick={() => setModal({ mode: "create", date: shownDay })}>
                <Plus aria-hidden size={16} strokeWidth={3} />
                ADD
              </StickerButton>
            </div>
            {shownDayEvents.length === 0 ? (
              <p className="font-hand text-3xl text-[var(--ink-soft)]">nothing on this day.</p>
            ) : (
              shownDayEvents.map((event) => (
                <Card key={event.id} as="article" tone={eventColor(event.id)}>
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "view", event })}
                    className="flex min-h-11 w-full min-w-0 cursor-pointer flex-col gap-1 rounded-[var(--radius-card)] p-3 text-left"
                  >
                    <span className="font-display text-xs">{rangeLabel(event)}</span>
                    <span className="text-base font-bold [overflow-wrap:anywhere]">{event.summary}</span>
                    {event.location && (
                      <span className="flex min-w-0 items-center gap-1 text-sm">
                        <MapPin aria-hidden size={14} strokeWidth={3} className="shrink-0" />
                        <span className="truncate">{event.location}</span>
                      </span>
                    )}
                  </button>
                </Card>
              ))
            )}
          </section>
        )}
      </main>

      {modal && (
        <EventModal
          mode={modal.mode}
          event={modal.mode !== "create" ? modal.event : undefined}
          initialDate={modal.mode === "create" ? modal.date : undefined}
          onClose={() => setModal(null)}
          onSaved={fetchEvents}
        />
      )}
    </div>
  );
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}
function startOfDayMs(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}
