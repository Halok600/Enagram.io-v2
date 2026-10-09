// The Enagram brand mark: a cobalt square sticker with an ink outline and a hard offset shadow, a heavy geometric
// "E", and a sun-yellow asterisk (the "*" of ENAGRAM*) stuck over its top-right corner. Same artwork as the favicon
// (src/app/icon.svg), but painted from the theme tokens so it follows dark and light. On a 64 grid the 4-unit outline
// is exactly var(--stroke) (2.5px) at the default 40px. Decorative: the brand name is always next to it in text.

type Props = { size?: number; tilt?: boolean; className?: string };

/** The asterisk polygon: six arms, centre (50, 14), tip radius 12.5, half-width 3.2, a 3-unit outline so the arms stay open (see icon.svg). */
const ASTERISK =
  "M46.8 1.5h6.4v7l6-3.5 3.2 5.5-6 3.5 6 3.5-3.2 5.5-6-3.5v7h-6.4v-7l-6 3.5-3.2-5.5 6-3.5-6-3.5 3.2-5.5 6 3.5z";
/** The E: a 12-unit stem, three 8-unit arms with 4-unit gaps (one pixel at 16px), a shorter middle arm. */
const E = "M12 20h28v8H24v4h12v8H24v4h16v8H12z";

export function LogoMark({ size = 40, tilt = false, className = "" }: Props) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={`shrink-0 ${tilt ? "motion-safe:rotate-3" : ""} ${className}`}
    >
      <rect x="4" y="12" width="52" height="52" rx="4" style={{ fill: "var(--shadow-color)" }} />
      <rect x="2" y="10" width="48" height="48" rx="3" strokeWidth="4" style={{ fill: "var(--cobalt)", stroke: "var(--line)" }} />
      <path d={E} style={{ fill: "var(--on-cobalt)" }} />
      <path d={ASTERISK} strokeWidth="3" strokeLinejoin="round" style={{ fill: "var(--sun)", stroke: "var(--line)" }} />
    </svg>
  );
}
