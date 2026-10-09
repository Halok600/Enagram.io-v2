"use client";

import { useEffect, useState } from "react";
import type { TapeItem } from "@/lib/ui/tape";
import { TapeStrip } from "./TapeStrip";

// The slot the tape strip lives in. It grows from 0 to the strip's height (and back) so the page below does not
// jump while a message streams. The live region is always mounted, so screen readers announce the strip when
// content arrives; TapeStrip itself carries no role. The page container must hide horizontal overflow.
//
// Expand and collapse are symmetric: while the row animates the content is clipped to it (so a growing strip never
// spills over the page below), and on collapse the last items stay rendered until the row has closed, so the strip
// shrinks away instead of snapping out. When idle nothing is clipped vertically, so the tilt and shadow show.
export function TapeSlot({ items, onRetry }: { items: TapeItem[]; onRetry?: () => void }) {
  const open = items.length > 0;
  const [shown, setShown] = useState(items);
  const [wasOpen, setWasOpen] = useState(open);
  const [moving, setMoving] = useState(false);
  // Derived state, adjusted while rendering (React's documented pattern): remember the last non-empty items.
  if (open && items !== shown) setShown(items);
  if (open !== wasOpen) {
    setWasOpen(open);
    setMoving(true);
  }

  const settle = () => {
    setMoving(false);
    if (!open) setShown([]);
  };
  // transitionend can be skipped (display none, reduced motion), so settle on a timer as well.
  useEffect(() => {
    if (!moving) return;
    const t = setTimeout(settle, 350);
    return () => clearTimeout(t);
    // settle only reads `open`, which changes together with `moving`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [moving, open]);

  return (
    <div
      onTransitionEnd={(e) => {
        if (e.target === e.currentTarget) settle();
      }}
      className={`relative z-10 grid overflow-x-clip transition-[grid-template-rows] duration-200 ease-out ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className={`min-h-0 ${moving ? "overflow-clip" : ""}`}>
        <div role="status" aria-live="polite" aria-atomic="false">
          <TapeStrip items={open ? items : shown} onRetry={onRetry} />
        </div>
      </div>
    </div>
  );
}
