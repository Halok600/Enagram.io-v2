"use client";

import { useCallback, useEffect, useId, useRef, useState, type ChangeEvent, type KeyboardEvent, type MouseEvent } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { X, Trash2, Pencil, ExternalLink, MapPin, CalendarClock } from "lucide-react";
import { parseEventDate } from "@/lib/calendar-date";
import { canConfirmDelete } from "@/lib/ui/delete-confirm";
import { eventColor } from "@/lib/ui/event-color";
import { Card } from "../ui/Card";
import { Field } from "../ui/Field";
import { StickerButton } from "../ui/StickerButton";
import { Switch } from "../ui/Switch";
import { TONE_CLASS } from "../ui/tone";

export type CalendarEventDTO = {
  id: string;
  summary: string;
  description: string;
  location: string;
  start: string;
  end: string;
  isAllDay: boolean;
  htmlLink: string;
};

/** Bare `datetime-local` input values have no timezone — the browser
 * means them as local wall-clock time, so `new Date(value)` (no 'Z'
 * suffix) is interpreted as local by the JS Date spec, and toISOString()
 * then gives a correct, unambiguous UTC instant ('Z' counts as an
 * explicit timezone designator — matches what createEvent/updateEvent
 * require, see calendar.ts/tools.ts). */
function toApiDateTime(localValue: string): string {
  return new Date(localValue).toISOString();
}

function formatDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDateOnly(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function toDatetimeLocalValue(iso: string): string {
  return formatDatetimeLocal(new Date(iso));
}

function toDateOnlyValue(value: string): string {
  return formatDateOnly(parseEventDate(value));
}

function defaultTimes(initialDate?: Date): { start: string; end: string } {
  const base = initialDate ? new Date(initialDate) : new Date();
  base.setHours(9, 0, 0, 0);
  const end = new Date(base);
  end.setHours(base.getHours() + 1);
  return { start: formatDatetimeLocal(base), end: formatDatetimeLocal(end) };
}

function formatAllDayRange(start: string, end: string): string {
  const startLabel = parseEventDate(start).toLocaleDateString([], { dateStyle: "medium" });
  if (start === end) return `${startLabel} · All day`;
  const endLabel = parseEventDate(end).toLocaleDateString([], { dateStyle: "medium" });
  return `${startLabel} – ${endLabel} · All day`;
}

export function EventModal({
  mode,
  event,
  initialDate,
  onClose,
  onSaved,
}: {
  mode: "create" | "view" | "edit";
  event?: CalendarEventDTO;
  initialDate?: Date;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [localMode, setLocalMode] = useState<"view" | "edit" | "create">(mode);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus management (presentation only): remember what had focus when the dialog opened (read during the first
  // render, before the autofocus of the title field) and give it back when the dialog closes. A day cell or event
  // bar of the month grid is not focusable, so for those focus simply stays where it is.
  const [opener] = useState<Element | null>(() => (typeof document === "undefined" ? null : document.activeElement));
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeAndRestoreFocus = useCallback(() => {
    onClose();
    if (opener instanceof HTMLElement && opener.isConnected && opener !== document.body) opener.focus();
  }, [onClose, opener]);

  // The dialog takes focus on open when nothing inside it has it (view mode has no autofocus field).
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
  }, []);

  // Escape closes the dialog, except while a save or delete request is in flight.
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented || saving) return;
      e.preventDefault();
      closeAndRestoreFocus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [saving, closeAndRestoreFocus]);

  const [form, setForm] = useState(() =>
    event
      ? {
          summary: event.summary,
          location: event.location,
          description: event.description,
          allDay: event.isAllDay,
          start: event.isAllDay ? event.start : toDatetimeLocalValue(event.start),
          end: event.isAllDay ? event.end : toDatetimeLocalValue(event.end),
        }
      : { summary: "", location: "", description: "", allDay: false, ...defaultTimes(initialDate) },
  );

  function handleToggleAllDay(nextAllDay: boolean) {
    setForm((f) => {
      if (nextAllDay) {
        return { ...f, allDay: true, start: toDateOnlyValue(f.start), end: toDateOnlyValue(f.end) };
      }
      const start = parseEventDate(f.start);
      start.setHours(9, 0, 0, 0);
      const end = parseEventDate(f.end);
      end.setHours(10, 0, 0, 0);
      return { ...f, allDay: false, start: formatDatetimeLocal(start), end: formatDatetimeLocal(end) };
    });
  }

  async function handleSave() {
    if (!form.summary.trim()) {
      setError("Title is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        summary: form.summary,
        startDateTime: form.allDay ? form.start : toApiDateTime(form.start),
        endDateTime: form.allDay ? form.end : toApiDateTime(form.end),
        description: form.description,
        location: form.location,
        allDay: form.allDay,
      };
      const res = await fetch(event ? `/api/calendar/events/${event.id}` : "/api/calendar/events", {
        method: event ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save event");
      onSaved();
      closeAndRestoreFocus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save event");
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!event) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/calendar/events/${event.id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to delete event");
      onSaved();
      closeAndRestoreFocus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
      setSaving(false);
    }
  }

  // Presentation only: the two-step Delete. The first click arms the button ("SURE? DELETE"); a later, separate
  // click runs handleDelete above, which is unchanged. The armed button is the same element in the same place, so
  // clicks in the first 700 ms (a fast double-click, a held Enter) and the repeated click of a multi-click are
  // ignored (canConfirmDelete). An armed button disarms itself after a few seconds.
  const armedAtRef = useRef<number | null>(null);

  function disarmDelete() {
    armedAtRef.current = null;
    setConfirmingDelete(false);
  }

  function handleDeleteClick(e: MouseEvent<HTMLButtonElement>) {
    if (!confirmingDelete) {
      armedAtRef.current = Date.now();
      setConfirmingDelete(true);
      return;
    }
    if (!canConfirmDelete(armedAtRef.current, Date.now(), e.detail)) return;
    void handleDelete();
  }

  // Holding Enter on the armed button repeats the click; ignore the repeats (the first press arms or confirms).
  function handleDeleteKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.repeat && e.key === "Enter") e.preventDefault();
  }

  useEffect(() => {
    if (!confirmingDelete) return;
    const timer = setTimeout(() => {
      armedAtRef.current = null;
      setConfirmingDelete(false);
    }, 4000);
    return () => clearTimeout(timer);
  }, [confirmingDelete]);

  const reduceMotion = useReducedMotion();
  const uid = useId();
  const isFormMode = localMode === "create" || localMode === "edit";
  const heading = localMode === "create" ? "New event" : localMode === "edit" ? "Edit event" : (event?.summary ?? "");

  const deleteButton = (
    <StickerButton
      tone="danger"
      onClick={handleDeleteClick}
      onKeyDown={handleDeleteKeyDown}
      disabled={saving}
      // Armed: a dashed outline round the button on top of the new label.
      className={confirmingDelete ? "outline-3 outline-offset-4 outline-[color:var(--ink)] outline-dashed" : ""}
    >
      {confirmingDelete ? (
        "SURE? DELETE"
      ) : (
        <>
          <Trash2 aria-hidden size={16} strokeWidth={3} />
          DELETE
        </>
      )}
    </StickerButton>
  );

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--bg)_72%,transparent)] p-4"
      onClick={closeAndRestoreFocus}
    >
      {/* The sheet pops in with a small rotation (a plain fade under reduced motion), then lies flat: it carries
          text and inputs, so it is never rotated once it has landed. */}
      <motion.div
        ref={dialogRef}
        role="dialog"
        aria-labelledby={`${uid}-heading`}
        tabIndex={-1}
        // The dialog itself only receives focus programmatically (view mode); no ring round the whole sheet.
        style={{ outline: "none", boxShadow: "none" }}
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 14, rotate: -3 }}
        animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
        exit={{ opacity: 0 }}
        transition={reduceMotion ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 26 }}
        onClick={(e) => e.stopPropagation()}
        className="sheet w-full max-w-xl"
      >
        <div aria-hidden className="sheet-shadow sheet-clip" />
        <Card shadow="none" className="sheet-clip relative max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-7">
          <h2 id={`${uid}-heading`} className="font-display pr-[var(--fold)] text-3xl [overflow-wrap:anywhere] sm:text-4xl">
            {heading}
          </h2>

          {isFormMode ? (
            <div className="mt-6 flex flex-col gap-4">
              <Field
                id={`${uid}-title`}
                label="Title"
                value={form.summary}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, summary: e.target.value }))}
                placeholder="Title"
                autoFocus
              />
              <Switch checked={form.allDay} onChange={handleToggleAllDay} label="All day" />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  id={`${uid}-start`}
                  label="Start"
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.start}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, start: e.target.value }))}
                />
                <Field
                  id={`${uid}-end`}
                  label="End"
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.end}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, end: e.target.value }))}
                />
              </div>
              <Field
                id={`${uid}-location`}
                label="Location"
                value={form.location}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, location: e.target.value }))}
                placeholder="Location (optional)"
              />
              <Field
                id={`${uid}-description`}
                label="Description"
                multiline
                rows={3}
                value={form.description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Description (optional)"
              />
              {error && (
                <p role="alert" className="text-sm font-bold text-[var(--danger-ink)]">
                  {error}
                </p>
              )}
              <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
                <div className="ml-auto flex flex-wrap gap-3">
                  <StickerButton onClick={closeAndRestoreFocus}>CANCEL</StickerButton>
                  <StickerButton tone="cobalt" onClick={handleSave} disabled={saving}>
                    {saving ? "SAVING…" : "SAVE"}
                  </StickerButton>
                </div>
              </div>
            </div>
          ) : (
            event && (
              <div className="mt-5 flex flex-col gap-4">
                {/* A ticket: a colour band with the time, the facts below it, a perforation, then the link. */}
                <div
                  className={`flex items-center gap-2.5 rounded-[2px] border-[length:var(--stroke)] border-[var(--line)] px-3.5 py-2.5 ${TONE_CLASS[eventColor(event.id)]}`}
                >
                  <CalendarClock aria-hidden size={20} strokeWidth={3} className="shrink-0" />
                  <p className="text-sm font-bold">
                    {event.isAllDay
                      ? formatAllDayRange(event.start, event.end)
                      : `${new Date(event.start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} – ${new Date(event.end).toLocaleString([], { timeStyle: "short" })}`}
                  </p>
                </div>
                {event.location && (
                  <p className="flex items-start gap-2 text-base">
                    <MapPin aria-hidden size={18} strokeWidth={3} className="mt-1 shrink-0" />
                    <span className="[overflow-wrap:anywhere]">{event.location}</span>
                  </p>
                )}
                {event.description && <p className="text-base [overflow-wrap:anywhere]">{event.description}</p>}

                <div aria-hidden className="border-t-[length:var(--stroke)] border-dashed border-[var(--line)]" />

                <a
                  href={event.htmlLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 w-fit items-center gap-2 rounded-[var(--radius-card)] text-sm font-bold text-[var(--link)] underline underline-offset-4"
                >
                  <ExternalLink aria-hidden size={16} strokeWidth={3} />
                  Open in Google Calendar
                </a>

                {error && (
                  <p role="alert" className="text-sm font-bold text-[var(--danger-ink)]">
                    {error}
                  </p>
                )}

                <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
                  {deleteButton}
                  <StickerButton
                    onClick={() => {
                      disarmDelete();
                      setLocalMode("edit");
                    }}
                  >
                    <Pencil aria-hidden size={16} strokeWidth={3} />
                    EDIT
                  </StickerButton>
                </div>
                {/* A handwritten nudge while the Delete button is armed; the space is reserved so nothing jumps. */}
                <p aria-live="polite" className="font-hand -mt-2 min-h-7 text-2xl text-[var(--danger-ink)]">
                  {confirmingDelete ? "click again to confirm" : ""}
                </p>
              </div>
            )
          )}

        </Card>
        <div aria-hidden className="sheet-flap" />
        <button
          type="button"
          onClick={closeAndRestoreFocus}
          aria-label="Close"
          className="pressable absolute top-[calc(var(--fold)+0.25rem)] right-3 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--panel)] text-[var(--ink)] [--elevation:var(--shadow-hard-sm)]"
        >
          <X aria-hidden size={20} strokeWidth={3} />
        </button>
      </motion.div>
    </motion.div>
  );
}
