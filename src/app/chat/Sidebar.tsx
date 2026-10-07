"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Mail,
  HardDrive,
  Search,
  Radio,
  PenLine,
  CalendarDays,
  BookMarked,
  Eraser,
  Network,
  CalendarPlus,
  CalendarCog,
  CalendarX,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SyncButton } from "../SyncButton";
import { disconnect } from "../actions";
import { ThemeToggle } from "./ThemeToggle";
import { CalendarHoverCard } from "../components/CalendarHoverCard";

const TOOL_META: Record<string, { label: string; icon: typeof Mail }> = {
  search_gmail: { label: "Searching Gmail", icon: Mail },
  search_drive: { label: "Searching Drive", icon: HardDrive },
  search_calendar: { label: "Searching Calendar", icon: CalendarDays },
  draft_gmail_reply: { label: "Drafting reply", icon: PenLine },
  save_preference: { label: "Saving memory", icon: BookMarked },
  forget_preference: { label: "Forgetting", icon: Eraser },
  find_related: { label: "Mapping links", icon: Network },
  create_calendar_event: { label: "Creating event", icon: CalendarPlus },
  update_calendar_event: { label: "Updating event", icon: CalendarCog },
  delete_calendar_event: { label: "Deleting event", icon: CalendarX },
};

function StatusRow({ icon: Icon, label }: { icon: typeof Mail; label: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[var(--radius-sm)] bg-[var(--bg-panel)] px-3 py-2.5">
      <span className="flex items-center gap-2.5 text-sm font-medium text-[var(--text-primary)]">
        <Icon size={18} className="text-[var(--accent)]" />
        {label}
      </span>
      <span className="flex items-center gap-2 text-xs font-medium text-[var(--success)]">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)]" aria-hidden />
        Connected
      </span>
    </div>
  );
}

/** Gmail/Drive rows open the real app in a new tab — external URLs, so a
 * plain anchor (not next/link, which is for internal routing) with the
 * standard target="_blank" rel="noopener noreferrer" pairing (noopener
 * stops the new tab from reaching back via window.opener). */
function ExternalStatusLink({ href, icon, label }: { href: string; icon: typeof Mail; label: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className="block">
      <StatusRow icon={icon} label={label} />
    </a>
  );
}

/** The only one of the three connected-source rows that links internally
 * and shows a hover preview — Gmail/Drive open the real app externally. */
function CalendarStatusRow() {
  const [isHovering, setIsHovering] = useState(false);

  return (
    <div
      className="relative"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
    >
      <Link href="/calendar" className="block">
        <StatusRow icon={CalendarDays} label="Calendar" />
      </Link>
      <AnimatePresence>{isHovering && <CalendarHoverCard />}</AnimatePresence>
    </div>
  );
}

function ActiveTools({ tools }: { tools: string[] }) {
  if (tools.length === 0) {
    return (
      <div className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--bg-panel)] px-3 py-2.5 text-sm text-[var(--text-tertiary)]">
        <Radio size={16} />
        Idle
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {tools.map((tool) => {
        const meta = TOOL_META[tool] ?? { label: tool, icon: Search };
        const Icon = meta.icon;
        return (
          <div
            key={tool}
            className="flex items-center gap-2.5 rounded-[var(--radius-sm)] bg-[var(--accent-soft-bg)] px-3 py-2.5 text-sm font-medium text-[var(--accent)]"
          >
            <Icon size={16} />
            <motion.span
              className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]"
              animate={{ opacity: [0.35, 1, 0.35], scale: [0.85, 1, 0.85] }}
              transition={{ duration: 1.3, repeat: Infinity, ease: "easeInOut" }}
              aria-hidden
            />
            {meta.label}
          </div>
        );
      })}
    </div>
  );
}

export function Sidebar({
  email,
  activeTools,
  ingestionEnabled,
}: {
  email: string;
  activeTools: string[];
  ingestionEnabled: boolean;
}) {
  return (
    <aside className="flex h-full w-80 shrink-0 flex-col justify-between rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--bg-sidebar)] p-6">
      <div className="flex flex-col gap-8">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-[var(--text-primary)]">
              Enagram.io
            </h1>
            <p className="mt-1 truncate text-xs text-[var(--text-tertiary)]">{email}</p>
          </div>
          <ThemeToggle />
        </div>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Connected sources
          </h2>
          <ExternalStatusLink href="https://mail.google.com" icon={Mail} label="Gmail" />
          <ExternalStatusLink href="https://drive.google.com" icon={HardDrive} label="Drive" />
          <CalendarStatusRow />
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[var(--text-tertiary)]">
            Activity
          </h2>
          <ActiveTools tools={activeTools} />
        </section>
      </div>

      <div className="flex flex-col gap-3">
        {ingestionEnabled ? (
          <SyncButton />
        ) : (
          <p className="text-xs leading-snug text-[var(--text-tertiary)]">
            Re-sync runs from local dev only — this deployment reads the same shared brain.
          </p>
        )}
        <form action={disconnect}>
          <motion.button
            type="submit"
            whileHover={{ y: -1, boxShadow: "var(--shadow-md)" }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="w-full rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg-panel)] px-4 py-3 text-sm font-medium text-[var(--danger)]"
            style={{ boxShadow: "var(--shadow-sm)" }}
          >
            Disconnect
          </motion.button>
        </form>
      </div>
    </aside>
  );
}
