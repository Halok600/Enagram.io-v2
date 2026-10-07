"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, type PanInfo } from "framer-motion";
import { ChevronLeft, ChevronRight, Plus, ArrowLeft } from "lucide-react";
import { EventModal, type CalendarEventDTO } from "./EventModal";
import { parseEventDate, shiftDateOnly } from "@/lib/calendar-date";

type ViewMode = "month" | "week";
type ModalState = { mode: "create"; date: Date } | { mode: "view" | "edit"; event: CalendarEventDTO } | null;

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

export function CalendarBoard() {
  const router = useRouter();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [cursor, setCursor] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEventDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>(null);
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const requestIdRef = useRef(0);

  const gridStart = useMemo(
    () => (viewMode === "month" ? startOfMonthGrid(cursor) : startOfWeek(cursor)),
    [viewMode, cursor],
  );
  const gridDays = viewMode === "month" ? MONTH_GRID_WEEKS * 7 : 7;
  const gridEnd = useMemo(() => addDays(gridStart, gridDays), [gridStart, gridDays]);

  // Deliberately NOT async/await: this project's lint config flags any
  // setState reachable synchronously from an effect body (see JOURNAL.md
  // 2026-08-10, the useSpeechRecognition fix earlier this session). An
  // async function's statements before its first `await` still run
  // synchronously when invoked, so `setLoading(true)` as the first line of
  // an async fetchEvents would trip the same rule. Structuring this as a
  // plain function whose only synchronous statement is the fetch() call
  // itself — every setState happens inside a later .then() callback,
  // never synchronously in the effect's call stack — sidesteps it cleanly,
  // matching CalendarHoverCard.tsx's already-correct pattern.
  // Guarded by a monotonic request id rather than a single per-effect
  // `cancelled` flag (CalendarHoverCard.tsx's pattern) because fetchEvents
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

  const days = Array.from({ length: gridDays }, (_, i) => addDays(gridStart, i));

  return (
    <div className="flex h-screen w-screen flex-col gap-4 overflow-hidden p-4">
      <header className="flex items-center justify-between gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)] px-5 py-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/")}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] px-2 py-1.5 text-sm font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-panel-raised)]"
          >
            <ArrowLeft size={16} />
            Back to chat
          </button>
          <span className="h-5 w-px bg-[var(--border)]" />
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Previous"
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-panel-raised)]"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => navigate(1)}
            aria-label="Next"
            className="rounded-[var(--radius-sm)] p-1.5 text-[var(--text-secondary)] hover:bg-[var(--bg-panel-raised)]"
          >
            <ChevronRight size={18} />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date())}
            className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)]"
          >
            Today
          </button>
          <h1 className="text-lg font-semibold text-[var(--text-primary)]">
            {cursor.toLocaleDateString([], { month: "long", year: "numeric" })}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-[var(--radius-sm)] border border-[var(--border)] p-0.5">
            {(["month", "week"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`rounded-[calc(var(--radius-sm)-2px)] px-3 py-1 text-sm font-medium capitalize transition-colors ${
                  viewMode === mode
                    ? "bg-[var(--accent-soft-bg)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
          <motion.button
            type="button"
            onClick={() => setModal({ mode: "create", date: new Date() })}
            whileHover={{ y: -1, boxShadow: "var(--shadow-md)" }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 rounded-[var(--radius-sm)] bg-[var(--accent-strong)] px-3 py-2 text-sm font-semibold text-white"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            <Plus size={16} />
            Add event
          </motion.button>
        </div>
      </header>

      <div className="flex flex-1 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)]">
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="px-3 py-2 text-center text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
              {label}
            </div>
          ))}
        </div>

        {viewMode === "month" ? (
          <div className="grid flex-1 grid-cols-7 overflow-y-auto">
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDay.get(key) ?? [];
              const visible = dayEvents.slice(0, 3);
              const overflow = dayEvents.length - visible.length;

              return (
                <div
                  key={key}
                  ref={(el) => {
                    if (el) cellRefs.current.set(key, el);
                    else cellRefs.current.delete(key);
                  }}
                  onClick={() => setModal({ mode: "create", date: day })}
                  className={`flex min-h-[100px] cursor-pointer flex-col gap-1 border-b border-r border-[var(--border)] p-1.5 last:border-r-0 ${
                    sameMonth(day, cursor) ? "" : "opacity-40"
                  }`}
                >
                  <span
                    className={`w-fit rounded-full px-1.5 text-xs font-medium ${
                      isToday(day) ? "bg-[var(--accent-strong)] text-white" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {visible.map((event) => (
                    <motion.div
                      key={event.id}
                      drag
                      dragSnapToOrigin
                      dragMomentum={false}
                      whileDrag={{ scale: 1.05, zIndex: 50, boxShadow: "var(--shadow-md)" }}
                      onDragEnd={(_, info) => handleChipDragEnd(event, info)}
                      onClick={(e) => {
                        e.stopPropagation();
                        setModal({ mode: "view", event });
                      }}
                      className="truncate rounded-[var(--radius-sm)] bg-[var(--accent-soft-bg)] px-1.5 py-0.5 text-xs font-medium text-[var(--accent)]"
                    >
                      {event.summary}
                    </motion.div>
                  ))}
                  {overflow > 0 && (
                    <span className="text-xs text-[var(--text-tertiary)]">+{overflow} more</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid flex-1 grid-cols-7 overflow-y-auto">
            {days.map((day) => {
              const key = dateKey(day);
              const dayEvents = eventsByDay.get(key) ?? [];

              return (
                <div
                  key={key}
                  className="flex flex-col gap-1.5 border-r border-[var(--border)] p-2 last:border-r-0"
                >
                  <span
                    className={`w-fit rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isToday(day) ? "bg-[var(--accent-strong)] text-white" : "text-[var(--text-secondary)]"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  {dayEvents.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      onClick={() => setModal({ mode: "view", event })}
                      className="rounded-[var(--radius-sm)] bg-[var(--accent-soft-bg)] px-2 py-1 text-left text-xs font-medium text-[var(--accent)]"
                    >
                      {event.summary}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setModal({ mode: "create", date: day })}
                    className="rounded-[var(--radius-sm)] border border-dashed border-[var(--border)] px-2 py-1 text-left text-xs text-[var(--text-tertiary)]"
                  >
                    + Add
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {loading && (
          <div className="border-t border-[var(--border)] px-4 py-1.5 text-xs text-[var(--text-tertiary)]">
            Loading…
          </div>
        )}
      </div>

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
