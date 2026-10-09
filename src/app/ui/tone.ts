/** Fill + text colour pairs per tone. Every pair is contrast-tested in src/lib/ui/contrast.test.ts. */
export type Tone = "cobalt" | "sun" | "bubblegum" | "danger" | "plain";

export const TONE_CLASS: Record<Tone, string> = {
  cobalt: "bg-[var(--cobalt)] text-[var(--on-cobalt)]",
  sun: "bg-[var(--sun)] text-[var(--on-sun)]",
  bubblegum: "bg-[var(--bubblegum)] text-[var(--on-bubblegum)]",
  danger: "bg-[var(--danger)] text-[var(--on-danger)]",
  plain: "bg-[var(--panel)] text-[var(--ink)]",
};

/** The spring "thunk" shared by every pressable part. */
export const THUNK = { type: "spring", stiffness: 500, damping: 30 } as const;
