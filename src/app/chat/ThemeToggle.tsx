"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../ThemeProvider";

const TRACK_WIDTH = 64;
const THUMB_SIZE = 24;
const PADDING = 3;
const THUMB_TRAVEL = TRACK_WIDTH - THUMB_SIZE - PADDING * 2;

export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      className="relative shrink-0 rounded-full border border-[var(--border)] bg-[var(--bg-panel)] p-[3px]"
      style={{ width: TRACK_WIDTH, height: THUMB_SIZE + PADDING * 2 }}
    >
      <Moon
        size={12}
        className="pointer-events-none absolute left-[8px] top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
        aria-hidden
      />
      <Sun
        size={12}
        className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]"
        aria-hidden
      />
      {/* The track above never depends on theme, so it's always shown —
       * only the thumb (whose position/icon reveals what the real stored
       * theme is) waits for `mounted`, so it appears once, already
       * correct, instead of snapping into place from a wrong starting
       * position for a light-mode user. */}
      {mounted && (
        <motion.span
          className="relative z-10 flex items-center justify-center rounded-full bg-[var(--accent-strong)]"
          style={{ width: THUMB_SIZE, height: THUMB_SIZE }}
          initial={{ x: isDark ? 0 : THUMB_TRAVEL }}
          animate={{ x: isDark ? 0 : THUMB_TRAVEL }}
          transition={{ type: "spring", stiffness: 480, damping: 32 }}
        >
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={theme}
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              exit={{ opacity: 0, rotate: 90 }}
              transition={{ duration: 0.18 }}
              className="flex"
            >
              {isDark ? (
                <Moon size={13} className="text-white" />
              ) : (
                <Sun size={13} className="text-white" />
              )}
            </motion.span>
          </AnimatePresence>
        </motion.span>
      )}
    </button>
  );
}
