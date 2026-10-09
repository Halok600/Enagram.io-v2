"use client";

import { useId } from "react";

// A chunky switch built on a real checkbox (role="switch"), so keyboard and screen readers work natively.
// The visible track is a sibling of the input; the input's focus state drives the track's focus ring.
export function Switch({
  checked,
  onChange,
  label,
  id,
  hideLabel = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  id?: string;
  /** Keep the label for screen readers only (e.g. the top-bar theme switch). */
  hideLabel?: boolean;
}) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <label htmlFor={inputId} className="inline-flex min-h-11 cursor-pointer items-center gap-3 select-none">
      <span className={hideLabel ? "sr-only" : "text-sm font-bold"}>{label}</span>
      <input id={inputId} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="elev relative block h-8 w-14 shrink-0 rounded-[var(--radius-pill)] border-[length:var(--stroke)] border-[var(--line)] bg-[var(--panel)] transition-colors [--elevation:var(--shadow-hard-sm)] peer-checked:bg-[var(--sun)] peer-focus-visible:[outline:3px_solid_var(--ink)] peer-focus-visible:[outline-offset:2px] peer-focus-visible:[box-shadow:var(--elevation),0_0_0_6px_var(--sun)] peer-checked:[&>span]:translate-x-6"
      >
        <span className="absolute top-1/2 left-1 block h-4 w-4 -translate-y-1/2 rounded-full border-[length:var(--stroke)] border-[var(--line)] bg-[var(--ink)] transition-[translate] duration-150" />
      </span>
    </label>
  );
}
