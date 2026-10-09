"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent, type ReactNode } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { isDateOnly, parseEventDate } from "@/lib/calendar-date";
import { eventColor } from "@/lib/ui/event-color";
import { PEEK_FAILURE, peekToView, type PeekItem, type PeekView } from "@/lib/ui/peek";
import { Card } from "./Card";
import { THUNK, TONE_CLASS } from "./tone";

const MotionLink = motion.create(Link);

const HOVER_OPEN_MS = 120;
const HOVER_CLOSE_MS = 150;
const REFRESH_AFTER_MS = 60_000;
const WIDE = "(min-width: 768px)";

type Props = {
  /** The Calendar chip. It stays a normal link to /calendar. */
  children: ReactNode;
  /** Where the summary comes from; defaults to the live /api/calendar/summary. The design preview passes fixtures. */
  fetchSummary?: () => Promise<unknown>;
  /** Start open (the design preview only). */
  defaultOpen?: boolean;
};

async function fetchLiveSummary(): Promise<unknown> {
  const res = await fetch("/api/calendar/summary");
  return res.json();
}

function formatStart(start: string): string {
  const date = parseEventDate(start);
  if (Number.isNaN(date.getTime())) return "";
  return isDateOnly(start)
    ? date.toLocaleDateString([], { month: "short", day: "numeric" })
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const DOT: Record<ReturnType<typeof eventColor>, string> = {
  cobalt: "bg-[var(--cobalt)]",
  sun: "bg-[var(--sun)]",
  bubblegum: "bg-[var(--bubblegum)]",
};

function EventRow({ item }: { item: PeekItem }) {
  const when = formatStart(item.start);
  const body = (
    <>
      <span aria-hidden className={`mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-[var(--line)] ${DOT[eventColor(item.key)]}`} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold" title={item.title}>
          {item.title}
        </span>
        {when ? <span className="font-hand block truncate text-lg text-[var(--ink-soft)]">{when}</span> : null}
      </span>
      {item.href ? <span className="sr-only">(opens in a new tab)</span> : null}
    </>
  );
  const row = "flex items-start gap-2.5 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--bg)] px-2.5 py-1.5";
  if (item.href) {
    return (
      <li>
        <a href={item.href} target="_blank" rel="noopener noreferrer" className={`${row} pressable [--elevation:var(--shadow-hard-sm)]`}>
          {body}
        </a>
      </li>
    );
  }
  return (
    <li>
      <div className={row}>{body}</div>
    </li>
  );
}

function PeekBody({ view, busy }: { view: PeekView | null; busy: boolean }) {
  if (view === null) {
    return <p className="mt-3 text-sm text-[var(--ink-soft)]">{busy ? "Loading..." : ""}</p>;
  }
  if (view.status === "error") {
    return (
      <p role="alert" className="mt-3 text-sm font-bold text-[var(--danger-ink)]">
        {view.message}
      </p>
    );
  }
  return (
    <>
      <p className="font-display mt-2 text-6xl text-[var(--link)]">{view.count}</p>
      <p className="text-sm text-[var(--ink-soft)]">{view.count === 1 ? "event this month" : "events this month"}</p>
      {view.items.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {view.items.map((item) => (
            <EventRow key={item.key} item={item} />
          ))}
        </ul>
      ) : (
        <p className="font-display mt-4 text-sm" style={{ lineHeight: 1.25 }}>
          Nothing upcoming this month.
        </p>
      )}
    </>
  );
}

// Wraps the Calendar chip of the top bar and shows a small live summary of the month while the pointer rests on it
// or keyboard focus is inside it. Not modal: no focus trap, the chip keeps navigating, Escape closes it.
// Left-aligned under the chip, but near the right edge of a tablet-width screen it slides left so the card stays
// on screen. A direct style write (measured once the box exists), so there is no state to set.
function keepOnScreen(el: HTMLDivElement | null) {
  if (!el) return;
  el.style.left = "0px";
  const over = el.getBoundingClientRect().right - (window.innerWidth - 16);
  if (over > 0) el.style.left = `-${Math.ceil(over)}px`;
}

export function CalendarPeek({ children, fetchSummary = fetchLiveSummary, defaultOpen = false }: Props) {
  const reduce = useReducedMotion();
  const [open, setOpen] = useState(defaultOpen);
  const [view, setView] = useState<PeekView | null>(null);
  const [busy, setBusy] = useState(defaultOpen);
  const wrapper = useRef<HTMLDivElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const inFlight = useRef(false);
  const loadedAt = useRef<number | null>(null);
  const mounted = useRef(false);
  const hovering = useRef(false);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  };

  // Starts a request; every state change happens inside .then, so it is safe to call from an effect as well.
  // A response that is no longer the latest, or arrives after unmount, is ignored.
  const load = useCallback(() => {
    const id = ++requestId.current;
    inFlight.current = true;
    Promise.resolve()
      .then(() => fetchSummary())
      .then(peekToView, (): PeekView => ({ status: "error", message: PEEK_FAILURE }))
      .then((next) => {
        if (!mounted.current || id !== requestId.current) return;
        inFlight.current = false;
        if (next.status === "ok") loadedAt.current = Date.now();
        setView(next);
        setBusy(false);
      });
  }, [fetchSummary]);

  useEffect(() => {
    mounted.current = true;
    // The preview opens the card straight away; a phone-width screen shows nothing and fetches nothing.
    if (defaultOpen && window.matchMedia(WIDE).matches) load();
    return () => {
      mounted.current = false;
      if (openTimer.current) clearTimeout(openTimer.current);
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [defaultOpen, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      clearTimers();
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const show = () => {
    clearTimers();
    if (!window.matchMedia(WIDE).matches) return;
    setOpen(true);
    const stale = loadedAt.current === null || Date.now() - loadedAt.current > REFRESH_AFTER_MS;
    if (stale && !inFlight.current) {
      setBusy(true);
      load();
    }
  };

  const onPointerEnter = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    hovering.current = true;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = null;
    if (open || openTimer.current) return;
    openTimer.current = setTimeout(show, HOVER_OPEN_MS);
  };

  const onPointerLeave = (e: PointerEvent) => {
    if (e.pointerType === "touch") return;
    hovering.current = false;
    if (openTimer.current) clearTimeout(openTimer.current);
    openTimer.current = null;
    if (!open) return;
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, HOVER_CLOSE_MS);
  };

  // Keyboard focus opens it at once; a mouse click that happens to focus the chip does not (it is about to navigate).
  const onFocus = (e: FocusEvent) => {
    if (e.target instanceof Element && e.target.matches(":focus-visible")) show();
  };

  // Focus moving out of the wrapper closes it. A null relatedTarget (a click on plain card text, or the window losing
  // focus) only closes it when the pointer is not over it.
  const onBlur = (e: FocusEvent) => {
    const next = e.relatedTarget;
    if (next instanceof Node && wrapper.current?.contains(next)) return;
    if (next === null && hovering.current) return;
    clearTimers();
    setOpen(false);
  };

  return (
    <div ref={wrapper} className="relative" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocus={onFocus} onBlur={onBlur}>
      {children}
      <AnimatePresence>
        {open ? (
          // The outer box has padding instead of a margin, so there is no dead gap between the chip and the card
          // for the pointer to fall through.
          <div key="peek" ref={keepOnScreen} className="absolute top-full left-0 z-40 w-80 max-w-[calc(100vw-2rem)] pt-3 max-md:hidden">
            <motion.div
              initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.14, ease: "easeOut" }}
              style={{ transformOrigin: "top left" }}
            >
              <Card as="section" role="region" aria-label="Calendar preview" aria-busy={busy} className="p-4">
                <p className="font-display text-sm tracking-wide">This month</p>
                <PeekBody view={view} busy={busy} />
                <MotionLink
                  href="/calendar"
                  whileHover={reduce ? undefined : { x: -1, y: -1 }}
                  whileTap={reduce ? undefined : { x: 2, y: 2 }}
                  transition={THUNK}
                  className={`pressable font-display mt-4 flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] px-4 text-sm leading-none tracking-wide ${TONE_CLASS.sun}`}
                >
                  OPEN CALENDAR <span aria-hidden>→</span>
                </MotionLink>
              </Card>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
