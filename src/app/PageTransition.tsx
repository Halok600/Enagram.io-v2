"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Wraps every route (chat ↔ /calendar) with a simple fade+slide entrance
 * for the incoming page. Deliberately NOT AnimatePresence/mode="wait"
 * anymore — that version blocked mounting the new page's content until
 * the OLD page's exit animation fully resolved, and /calendar's content
 * (drag-and-drop event chips, a modal with its own nested AnimatePresence
 * for the delete-confirm step) is complex enough that its exit could get
 * stuck, leaving the router already on the new URL with nothing rendered
 * — a real bug hit live (2026-08-13): navigating back from /calendar
 * updated the address bar but left a blank page. `key={pathname}` still
 * forces React to treat each route as a fresh element (so the entrance
 * animation replays every navigation), but the actual swap is now a
 * normal, synchronous, un-coordinated unmount+mount — there's no exit
 * phase to get stuck waiting on. Trades a full crossfade for a plainer
 * fade-in on arrival; reliable navigation matters far more than the
 * extra polish. See JOURNAL.md 2026-08-13.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <motion.div
      key={pathname}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="h-full w-full"
    >
      {children}
    </motion.div>
  );
}
