import { tickerText } from "@/lib/ui/tool-label";

const COPIES = 6;

// Hazard-tape ticker. The sentence scrolls with the `ticker` keyframes; the track holds two identical halves
// so the loop is seamless. Under reduced motion it stops and shows the text once. The visual track is
// aria-hidden; the live region carries the text once for screen readers.
export function WorkingTicker({ names }: { names: readonly string[] }) {
  const text = tickerText(names);
  const half = (hidden: boolean) => (
    <div aria-hidden className={`flex shrink-0 items-center ${hidden ? "motion-reduce:hidden" : ""}`}>
      {Array.from({ length: COPIES }, (_, i) => (
        <span key={i} className={`font-display flex items-center gap-6 pr-6 text-lg leading-none whitespace-nowrap ${i > 0 ? "motion-reduce:hidden" : ""}`}>
          {text}
          <span aria-hidden className="inline-block h-3 w-3 rotate-45 border-[length:var(--stroke)] border-[var(--on-sun)]" />
        </span>
      ))}
    </div>
  );
  return (
    <div
      role="status"
      aria-live="polite"
      className="elev relative overflow-hidden border-[length:var(--stroke)] border-[var(--line)] bg-[var(--sun)] text-[var(--on-sun)] [--elevation:var(--shadow-hard)] motion-safe:-rotate-[0.6deg]"
    >
      <span className="sr-only">{text}</span>
      <div aria-hidden className="hazard h-2.5 border-b-[length:var(--stroke)] border-[var(--line)]" />
      <div className="flex w-max py-3 motion-safe:animate-[ticker_16s_linear_infinite]">
        {half(false)}
        {half(true)}
      </div>
      <div aria-hidden className="hazard h-2.5 border-t-[length:var(--stroke)] border-[var(--line)]" />
    </div>
  );
}
