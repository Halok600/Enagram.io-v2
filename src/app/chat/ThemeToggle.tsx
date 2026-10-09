"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "../ThemeProvider";

// One sticker button split into two halves: sun (light) and moon (dark). The half that matches the
// current theme is pressed in (filled); the other is raised. Clicking anywhere flips the theme.
// Until the stored preference has been read (`mounted`), neither half is pressed, so a light-mode user
// never sees the dark default painted first and then flipped.
export function ThemeToggle() {
  const { theme, toggleTheme, mounted } = useTheme();
  const isDark = theme === "dark";

  const half = (pressed: boolean) =>
    `flex h-full w-11 items-center justify-center ${pressed ? "bg-[var(--sun)] text-[var(--on-sun)]" : "bg-[var(--panel)] text-[var(--ink)]"}`;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={mounted ? `Switch to ${isDark ? "light" : "dark"} mode` : "Toggle theme"}
      className="pressable relative inline-flex h-11 shrink-0 cursor-pointer overflow-hidden rounded-[var(--radius-card)] border-[length:var(--stroke)] border-[var(--line)]"
    >
      <span className={half(mounted && !isDark)}>
        <Sun aria-hidden size={20} strokeWidth={2.5} />
      </span>
      <span aria-hidden className="w-[2.5px] bg-[var(--line)]" />
      <span className={half(mounted && isDark)}>
        <Moon aria-hidden size={20} strokeWidth={2.5} />
      </span>
    </button>
  );
}
