"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Brain } from "lucide-react";
import { useTheme } from "../ThemeProvider";

/**
 * An original, generic bat silhouette for the dark-mode hero — simple
 * rounded double-curve wings and small ears, deliberately NOT DC/Warner
 * Bros' angular, scalloped-edge Batman emblem or the Arkham games' specific
 * art style. Same broad "bat for a dark/night theme" territory as the 🦇
 * emoji, not a recreation of anyone's registered trademark. See JOURNAL.md
 * 2026-08-10.
 */
function BatSilhouette({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 100 56" className={className} style={style} fill="currentColor" aria-hidden>
      <path
        d="M50 18
           C 42 4, 24 -2, 2 12
           C 16 13, 27 20, 33 28
           C 22 25, 7 30, 0 40
           C 20 39, 36 33, 47 30
           L 50 38 L 53 30
           C 64 33, 80 39, 100 40
           C 93 30, 78 25, 67 28
           C 73 20, 84 13, 98 12
           C 76 -2, 58 4, 50 18 Z"
      />
      <path d="M44 15 L 41 3 L 49 12 Z" />
      <path d="M56 15 L 59 3 L 51 12 Z" />
    </svg>
  );
}

/** Crossfades between the dark-mode bat silhouette and the light-mode
 * Brain icon whenever the theme changes — same AnimatePresence-by-key
 * pattern as PageTransition.tsx's route crossfade. */
export function HeroLogo() {
  const { theme, mounted } = useTheme();

  return (
    <div className="relative flex h-20 items-center justify-center">
      {/* Nothing renders until `mounted` is true, so the FIRST icon this
       * paints is already the correct one — otherwise a user whose real
       * preference differs from the hardcoded "dark" default would see the
       * wrong icon fully rendered and then watch it visibly crossfade away
       * once the real theme corrects. */}
      <AnimatePresence mode="wait">
        {!mounted ? null : theme === "dark" ? (
          <motion.div
            key="bat"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <BatSilhouette
              className="h-16 w-auto text-[var(--accent)]"
              style={{
                filter: "drop-shadow(0 0 14px var(--accent)) drop-shadow(0 0 32px var(--accent-strong))",
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="brain"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.85 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="flex items-center justify-center rounded-full bg-[var(--accent-soft-bg)] p-4"
            style={{ filter: "drop-shadow(0 4px 14px rgba(99, 102, 241, 0.3))" }}
          >
            <Brain size={40} className="text-[var(--accent)]" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
