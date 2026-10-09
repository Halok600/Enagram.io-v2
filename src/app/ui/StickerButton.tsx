"use client";

import type { ButtonHTMLAttributes } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { THUNK, TONE_CLASS, type Tone } from "./tone";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: Tone; // default "plain"
  size?: "md" | "lg"; // md = min-h 44px, lg = min-h 56px
};

// Hover raises the sticker up-left, press thunks it down into its shadow. The shadow itself is
// the --elevation variable (see .pressable in globals.css), so the focus ring can add to it.
export function StickerButton({ tone = "plain", size = "md", className = "", disabled, type = "button", children, ...rest }: Props) {
  const reduce = useReducedMotion();
  const live = !disabled && !reduce;
  const sizing = size === "lg" ? "min-h-14 px-7 text-lg" : "min-h-11 px-5 text-sm";
  // The motion.button typings reject a few native handler names that framer re-uses; they are unused here.
  const { onDrag: _d, onDragStart: _ds, onDragEnd: _de, onAnimationStart: _as, ...safe } = rest;
  void _d; void _ds; void _de; void _as;
  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileHover={live ? { x: -1, y: -1 } : undefined}
      whileTap={live ? { x: 3, y: 3 } : undefined}
      transition={THUNK}
      className={`pressable font-display inline-flex cursor-pointer items-center justify-center gap-2 rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)] leading-none tracking-wide disabled:cursor-not-allowed disabled:opacity-45 ${TONE_CLASS[tone]} ${sizing} ${className}`}
      {...safe}
    >
      {children}
    </motion.button>
  );
}
