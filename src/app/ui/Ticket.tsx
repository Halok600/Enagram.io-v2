"use client";

import { motion, useReducedMotion } from "framer-motion";
import { THUNK, TONE_CLASS } from "./tone";

// A notched, perforated source stub: dashed perforation, number badge on the right, truncated title.
// Layers (see .ticket-edge / .ticket-fill in globals.css): the outline layer and the fill layer are each
// cut by round notches, so the stroke follows every notch.
export function Ticket({ n, title, tone, url, score }: { n: number; title: string; tone: "cobalt" | "sun"; url?: string; score?: number }) {
  const reduce = useReducedMotion();
  const tilt = n % 2 === 0 ? "motion-safe:-rotate-[0.6deg]" : "motion-safe:rotate-[0.6deg]";
  const label = score === undefined ? title : `${title} (relevance ${score.toFixed(2)})`;
  const hover = reduce ? undefined : { rotate: n % 2 === 0 ? 0.6 : -0.6, x: url ? -1 : 0, y: url ? -1 : 0 };
  const body = (
    <div className="ticket-shadow">
      <div className="ticket-edge h-16">
        <div className={`ticket-fill ${TONE_CLASS[tone]}`}>
          <div className="flex h-full items-center">
            <span title={label} className="font-display min-w-0 flex-1 truncate pr-3 pl-6 text-[0.9rem]" style={{ lineHeight: 1.25 }}>
              {title}
            </span>
            <span
              aria-hidden
              className="pointer-events-none absolute inset-y-[calc(var(--r)+3px)] border-l-2 border-dashed border-current opacity-70"
              style={{ right: "calc(var(--w) - var(--s))" }}
            />
            <span className="font-display flex h-full shrink-0 items-center justify-center text-4xl" style={{ width: "calc(var(--w) - var(--s))" }}>
              {n}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
  const shared = { whileHover: hover, transition: THUNK, className: `ticket-link block w-full ${tilt}` } as const;
  if (url) {
    return (
      <motion.a href={url} target="_blank" rel="noopener noreferrer" aria-label={`Source ${n}: ${label}`} title={label} {...shared}>
        {body}
      </motion.a>
    );
  }
  return (
    <motion.div role="group" aria-label={`Source ${n}: ${label}`} title={label} {...shared}>
      {body}
    </motion.div>
  );
}
