"use client";

import { motion } from "framer-motion";
import { Brain } from "lucide-react";

/**
 * Full-screen, fixed-position overlay shown briefly by ThemeProvider on
 * every theme toggle. Purely decorative/cosmetic (pointer-events-none) —
 * the actual color change already happens underneath via the CSS
 * transition on custom properties, this just bridges it with a short,
 * deliberate flourish (a flat sticker, no glow or gradient) instead of an
 * instant flip. No brand logo asset exists in this project, so the
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
        initial={{ scale: 0.3, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 1.25, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
        className="relative flex items-center justify-center rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--sun)] p-7 text-[var(--on-sun)] [box-shadow:var(--shadow-hard-lg)]"
      >
        <Brain size={52} strokeWidth={2.5} />
      </motion.div>
    </motion.div>
  );
}
