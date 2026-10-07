"use client";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";

/**
 * Full-screen, fixed-position overlay shown briefly by ThemeProvider on
 * every theme toggle. Purely decorative/cosmetic (pointer-events-none) —
 * the actual color change already happens underneath via the CSS
 * transition on custom properties (globals.css's `*, *::before, *::after`
 * rule), this just bridges it with a short, deliberate flourish instead of
 * an instant flip. No brand logo asset exists in this project, so the
 * lucide-react Brain icon (thematically apt for a conversational agent
 * over the user's own data) stands in for one rather than inventing a
 * new asset.
 */
export function ThemeTransitionOverlay() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center"
      aria-hidden
    >
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.35 }}
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at center, rgba(139,92,246,0.4) 0%, rgba(99,102,241,0.18) 40%, transparent 72%)",
        }}
      />
      <motion.div
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.25, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative flex items-center justify-center rounded-full bg-[var(--bg-panel)] p-7"
        style={{ boxShadow: "0 0 70px rgba(139,92,246,0.55), 0 0 20px rgba(99,102,241,0.4)" }}
      >
        <Brain size={52} className="text-[var(--accent)]" />
      </motion.div>
    </motion.div>
  );
}
