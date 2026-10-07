"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { X, Trash2, Pencil, ExternalLink } from "lucide-react";
import { parseEventDate } from "@/lib/calendar-date";

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

const inputClasses =
  "w-full rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--bg-panel)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]";

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
      onClose();
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
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete event");
      setSaving(false);
    }
  }

  const isFormMode = localMode === "create" || localMode === "edit";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-panel)] p-6"
        style={{ boxShadow: "var(--shadow-md)" }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {localMode === "create" ? "New event" : localMode === "edit" ? "Edit event" : "Event details"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-[var(--radius-sm)] p-1 text-[var(--text-tertiary)] hover:bg-[var(--bg-panel-raised)]"
          >
            <X size={18} />
          </button>
        </div>

        {isFormMode ? (
          <div className="flex flex-col gap-3">
            <input
              value={form.summary}
              onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="Title"
              className={inputClasses}
              autoFocus
            />
            <label className="flex w-fit items-center gap-2 text-sm text-[var(--text-secondary)]">
              <input
                type="checkbox"
                checked={form.allDay}
                onChange={(e) => handleToggleAllDay(e.target.checked)}
              />
              All day
            </label>
            <div className="flex gap-3">
              <label className="flex-1 text-xs text-[var(--text-tertiary)]">
                Start
                <input
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.start}
                  onChange={(e) => setForm((f) => ({ ...f, start: e.target.value }))}
                  className={`${inputClasses} mt-1`}
                />
              </label>
              <label className="flex-1 text-xs text-[var(--text-tertiary)]">
                End
                <input
                  type={form.allDay ? "date" : "datetime-local"}
                  value={form.end}
                  onChange={(e) => setForm((f) => ({ ...f, end: e.target.value }))}
                  className={`${inputClasses} mt-1`}
                />
              </label>
            </div>
            <input
              value={form.location}
              onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Location (optional)"
              className={inputClasses}
            />
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)"
              rows={3}
              className={inputClasses}
            />
            {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
            <div className="mt-2 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-sm)] border border-[var(--border)] px-4 py-2 text-sm font-medium text-[var(--text-primary)]"
              >
                Cancel
              </button>
              <motion.button
                type="button"
                onClick={handleSave}
                disabled={saving}
                whileHover={saving ? undefined : { y: -1 }}
                whileTap={saving ? undefined : { scale: 0.97 }}
                className="rounded-[var(--radius-sm)] bg-[var(--accent-strong)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </motion.button>
            </div>
          </div>
        ) : (
          event && (
            <div className="flex flex-col gap-3">
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{event.summary}</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                {event.isAllDay
                  ? formatAllDayRange(event.start, event.end)
                  : `${new Date(event.start).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} – ${new Date(event.end).toLocaleString([], { timeStyle: "short" })}`}
              </p>
              {event.location && <p className="text-sm text-[var(--text-secondary)]">{event.location}</p>}
              {event.description && <p className="text-sm text-[var(--text-secondary)]">{event.description}</p>}
              <a
                href={event.htmlLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                <ExternalLink size={14} />
                Open in Google Calendar
              </a>

              {error && <p className="text-sm text-[var(--danger)]">{error}</p>}

              <div className="mt-2 flex justify-between gap-2 border-t border-[var(--border)] pt-4">
                {/* Plain conditional, not AnimatePresence: neither branch
                 * ever defined an `exit` animation, so `mode="wait"` had
                 * nothing to actually wait on — it was dead weight that
                 * would only become a real risk if this modal's own mount
                 * were later wrapped in an outer AnimatePresence (the same
                 * "child animation never signals exit-complete" mechanism
                 * that caused the blank-page navigation bug, see
                 * PageTransition.tsx / JOURNAL.md 2026-08-13). */}
                {confirmingDelete ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-sm text-[var(--text-secondary)]">Delete this event?</span>
                    <button
                      type="button"
                      onClick={handleDelete}
                      disabled={saving}
                      className="rounded-[var(--radius-sm)] bg-[var(--danger)] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      Yes, delete
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)]"
                    >
                      Cancel
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="delete"
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-medium text-[var(--danger)] hover:bg-[var(--danger-soft-bg)]"
                  >
                    <Trash2 size={14} />
                    Delete
                  </motion.button>
                )}

                {!confirmingDelete && (
                  <motion.button
                    type="button"
                    onClick={() => setLocalMode("edit")}
                    whileHover={{ y: -1 }}
                    className="inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border border-[var(--border)] px-3 py-1.5 text-sm font-medium text-[var(--text-primary)]"
                  >
                    <Pencil size={14} />
                    Edit
                  </motion.button>
                )}
              </div>
            </div>
          )
        )}
      </motion.div>
    </motion.div>
  );
}
