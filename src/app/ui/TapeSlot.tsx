"use client";

import type { TapeItem } from "@/lib/ui/tape";
import { TapeStrip } from "./TapeStrip";

// The slot the tape strip lives in. It grows from 0 to the strip's height (and back) so the page below does not
// jump while a message streams. The live region is always mounted, so screen readers announce the strip when
// content arrives; TapeStrip itself carries no role. The page container must hide horizontal overflow.
export function TapeSlot({ items, onRetry }: { items: TapeItem[]; onRetry?: () => void }) {
  return (
    <div
      className={`relative z-10 grid overflow-x-clip transition-[grid-template-rows] duration-200 ease-out ${
        items.length > 0 ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="min-h-0">
        <div role="status" aria-live="polite" aria-atomic="false">
          <TapeStrip items={items} onRetry={onRetry} />
        </div>
      </div>
    </div>
  );
}
