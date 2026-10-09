"use client";

import { useEffect, useId, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarDays, HardDrive, Mail, Menu, RefreshCw, X } from "lucide-react";
import { disconnect } from "../actions";
import { ThemeToggle } from "../chat/ThemeToggle";
import { CalendarPeek } from "./CalendarPeek";
import { Chip } from "./Chip";
import { LogoMark } from "./LogoMark";
import { StickerButton } from "./StickerButton";

type SyncProp = { state: "idle" | "loading" | "done" | "error"; run: () => void };

type Props = {
  email: string;
  /** Indexed document count from /api/health; null hides the handwritten note. */
  documents: number | null;
  sync: SyncProp;
  variant: "chat" | "calendar";
  /** Start with the folded menu open (the design preview uses this to picture the small-screen menu). */
  defaultOpen?: boolean;
};

/** A small "live" dot: a sun-yellow disc with an ink outline and, unless motion is reduced, a slow pulse ring. */
function LiveDot() {
  return (
    <span
      aria-hidden
      className="relative inline-block h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[var(--line)] bg-[var(--sun)] before:absolute before:-inset-0.5 before:rounded-full before:bg-[var(--sun)] before:opacity-60 motion-safe:before:animate-ping"
    />
  );
}

/** The status word. Always read by screen readers; shown on the Calendar sticker (and every sticker in the folded menu), where there is room. */
function Connected({ visible = false }: { visible?: boolean }) {
  return (
    <span className={`font-display text-[0.65rem] tracking-wider ${visible ? "" : "sr-only max-md:not-sr-only"}`}>Connected</span>
  );
}

function SyncSticker({ sync, className = "", onStart }: { sync: SyncProp; className?: string; onStart?: () => void }) {
  const loading = sync.state === "loading";
  return (
    <StickerButton
      tone={loading ? "sun" : "cobalt"}
      onClick={() => {
        onStart?.();
        sync.run();
      }}
      disabled={loading}
      aria-busy={loading}
      // A running sync stays at full strength (not dimmed): the label is the only sign something is happening
      // while the tape strip has nothing to say.
      className={`disabled:opacity-100! ${className}`}
    >
      <RefreshCw aria-hidden size={16} strokeWidth={3} className={loading ? "motion-safe:animate-spin" : ""} />
      {loading ? "SYNCING..." : "SYNC"}
    </StickerButton>
  );
}

// The shared top bar of the chat screen and the calendar page. From 768px up everything sits in one row
// (wrapping if it must); below that only the brand and a MENU sticker show and the rest folds into a panel.
export function TopBar({ email, documents, sync, variant, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const menuId = useId();
  const loading = sync.state === "loading";
  const menuButton = useRef<HTMLButtonElement>(null);
  const wrapper = useRef<HTMLDivElement>(null);

  // The folded menu closes on Escape and on a press outside the bar, so it never hides the tape messages below it.
  // Focus goes back to the MENU button only when it was inside the menu wrapper (the button or the panel); a focus
  // that lives elsewhere (the event dialog, the composer) is left alone.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const focusInsideMenu = wrapper.current?.contains(document.activeElement) ?? false;
      setOpen(false);
      if (focusInsideMenu) menuButton.current?.focus();
    };
    const onPointerDown = (e: PointerEvent) => {
      if (e.target instanceof Node && !wrapper.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const calendarChip = (
    <Chip href="/calendar" icon={<CalendarDays size={16} strokeWidth={2.5} />}>
      Calendar
      <LiveDot />
      <Connected visible />
    </Chip>
  );

  return (
    <header className="relative z-20 px-3 pt-3 md:px-5 md:pt-4">
      <div className="relative" ref={wrapper}>
        <div
          className="elev flex items-center justify-between gap-3 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--panel)] px-2.5 py-2.5 [--elevation:var(--shadow-hard)] sm:px-3 md:gap-4"
        >
          <Link href="/" aria-label="Enagram home" className="flex shrink-0 items-center gap-2 rounded-[var(--radius-card)] sm:gap-3">
            <LogoMark size={48} tilt className="max-[359px]:h-10 max-[359px]:w-10" />
            <span className="font-display inline-block rounded-[2px] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--sun)] px-2 py-1.5 text-base tracking-wide text-[var(--on-sun)] max-[359px]:px-1.5 max-[359px]:text-sm sm:px-2.5 sm:text-lg [box-shadow:var(--shadow-hard-sm)] motion-safe:-rotate-2">
              ENAGRAM*
            </span>
          </Link>

          <button
            ref={menuButton}
            type="button"
            aria-expanded={open}
            aria-controls={menuId}
            onClick={() => setOpen((v) => !v)}
            className="pressable font-display inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--sun)] px-3 text-sm leading-none tracking-wide text-[var(--on-sun)] max-[359px]:gap-1.5 max-[359px]:px-2 sm:px-4 md:hidden"
          >
            {open ? <X aria-hidden size={18} strokeWidth={3} /> : <Menu aria-hidden size={18} strokeWidth={3} />}
            MENU
            {loading ? (
              <>
                <RefreshCw aria-hidden size={14} strokeWidth={3} className="motion-safe:animate-spin max-[359px]:hidden" />
                <span className="sr-only">(syncing)</span>
              </>
            ) : null}
          </button>

          <div
            id={menuId}
            className={`${
              open
                ? "absolute inset-x-0 top-full z-30 mt-3 flex flex-col gap-4 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--panel)] p-4 [box-shadow:var(--shadow-hard)]"
                : "hidden"
            } md:static md:z-auto md:mt-0 md:flex md:flex-1 md:flex-row md:flex-wrap md:items-center md:justify-between md:gap-x-4 md:gap-y-2 md:rounded-none md:border-0 md:bg-transparent md:p-0 md:shadow-none`}
          >
            <p className="truncate text-sm text-[var(--ink-soft)] md:hidden">Signed in as {email}</p>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-3">
              <Chip href="https://mail.google.com" external icon={<Mail size={16} strokeWidth={2.5} />}>
                Gmail
                <LiveDot />
                <Connected />
              </Chip>
              <Chip href="https://drive.google.com" external icon={<HardDrive size={16} strokeWidth={2.5} />}>
                Drive
                <LiveDot />
                <Connected />
              </Chip>
              {variant === "chat" ? <CalendarPeek>{calendarChip}</CalendarPeek> : calendarChip}
              {variant === "calendar" ? (
                <Chip tone="sun" href="/" icon={<ArrowLeft size={16} strokeWidth={3} />} className="font-display tracking-wide">
                  CHAT
                </Chip>
              ) : null}
            </div>

            <div className="flex flex-col gap-4 md:ml-auto md:flex-row md:flex-wrap md:items-center md:justify-end md:gap-x-4 md:gap-y-2">
              {/* Low priority: it only shows where there is room (the calendar bar also carries the CHAT chip, so it waits for 2xl). */}
              <span
                title={email}
                className={`font-hand hidden max-w-[9rem] truncate text-lg text-[var(--ink-soft)] ${variant === "calendar" ? "2xl:block" : "xl:block"}`}
              >
                {email}
              </span>
              {documents !== null ? (
                <span className="font-hand text-2xl text-[var(--ink-soft)] md:-rotate-2 md:text-xl">{documents} docs indexed</span>
              ) : null}
              <div className="flex items-center gap-4 max-[359px]:gap-2">
                <SyncSticker sync={sync} className="max-md:min-w-0 max-md:flex-1 max-md:px-3!" onStart={() => setOpen(false)} />
                <ThemeToggle />
              </div>
              <form action={disconnect}>
                <button
                  type="submit"
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-[var(--radius-card)] px-2 text-sm font-bold underline-offset-4 hover:underline"
                >
                  Disconnect
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
