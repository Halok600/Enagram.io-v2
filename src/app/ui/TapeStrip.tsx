"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import type { TapeItem, TapeTone } from "@/lib/ui/tape";
import { StickerButton } from "./StickerButton";

const TONE: Record<TapeTone, { word: string; cls: string }> = {
  alert: { word: "ALERT", cls: "bg-[var(--danger)] text-[var(--on-danger)]" },
  working: { word: "WORKING", cls: "bg-[var(--sun)] text-[var(--on-sun)]" },
  ok: { word: "DONE", cls: "bg-[var(--panel)] text-[var(--ink)]" },
  warn: { word: "HEADS UP", cls: "bg-[var(--bubblegum)] text-[var(--on-bubblegum)]" },
};

// Full-bleed hazard band, tilted -1deg (motion-safe only). The page container must hide horizontal overflow.
// Every item carries a word prefix, so colour is never the only signal.
export function TapeStrip({ items, onRetry }: { items: TapeItem[]; onRetry?: () => void }) {
  if (items.length === 0) return null;
  return (
    <div role="status" aria-live="polite" className="relative z-10 -mx-[3%] w-[106%] bg-[var(--panel)] shadow-[0_6px_0_var(--shadow-color)] motion-safe:-rotate-1">
      <div aria-hidden className="hazard h-3.5 border-y-[length:var(--stroke)] border-[var(--line)]" />
      <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-2 px-[5%] py-3">
        {items.map((item) => {
          const t = TONE[item.tone];
          return (
            <li key={item.id} className="flex flex-wrap items-center gap-2">
              <span className={`inline-flex min-h-9 items-center gap-2 rounded-[var(--radius-pill)] border-[length:var(--stroke)] border-[var(--line)] py-1 pr-4 pl-3 text-sm leading-snug font-bold ${t.cls}`}>
                <TriangleAlert aria-hidden size={18} strokeWidth={2.5} className="shrink-0" />
                <span className="font-display text-xs tracking-wider whitespace-nowrap">{t.word}</span>
                <span>{item.text}</span>
              </span>
              {item.retry && onRetry ? (
                <StickerButton tone="plain" onClick={onRetry}>
                  <RotateCw aria-hidden size={16} strokeWidth={3} />
                  Retry
                </StickerButton>
              ) : null}
            </li>
          );
        })}
      </ul>
      <div aria-hidden className="hazard h-3.5 border-y-[length:var(--stroke)] border-[var(--line)]" />
    </div>
  );
}
