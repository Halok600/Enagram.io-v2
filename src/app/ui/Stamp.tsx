import type { ReactNode } from "react";
import { TONE_CLASS, type Tone } from "./tone";

// A small rubber-stamp label ("BRAIN", "TODAY", "FAILED"). Decorative tilt only; motion-safe drops it under reduced motion.
export function Stamp({ tone = "plain", children, className = "" }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span
      className={`elev font-display inline-block rounded-[2px] border-[length:var(--stroke)] border-[var(--line)] px-2 py-1 text-[0.7rem] leading-none tracking-wider motion-safe:-rotate-2 [--elevation:var(--shadow-hard-sm)] ${TONE_CLASS[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
