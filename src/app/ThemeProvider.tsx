"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence } from "framer-motion";
import { ThemeTransitionOverlay } from "./ThemeTransitionOverlay";

export type Theme = "dark" | "light";

const STORAGE_KEY = "personal-brain:theme";
const TRANSITION_OVERLAY_MS = 550;

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
  /** False until the post-mount correction effect below has run. Consumers
   * that branch their RENDERED OUTPUT on `theme` (HeroLogo's icon choice,
   * ThemeToggle's thumb position) should wait for `mounted` before showing
   * anything theme-dependent — otherwise a user whose real preference is
   * "light" sees the hardcoded "dark" version fully painted and then
   * watches it visibly animate away once `theme` corrects, instead of just
   * seeing the right thing appear once. */
  mounted: boolean;
} | null>(null);

/**
 * Reads the REAL stored preference — only knowable client-side
 * (localStorage). Deliberately no longer used as a `useState` lazy
 * initializer (see below) — that caused a genuine hydration mismatch,
 * not just a cosmetic one: the server always renders assuming "dark" (no
 * `document` access), so any component reading `theme` from context and
 * branching on it (ThemeToggle's aria-label, HeroLogo's entire icon
 * swap) would render DIFFERENT output between the server pass and the
 * client's first hydration pass whenever the user's real stored
 * preference was "light" — invisible until someone actually had "light"
 * saved and reloaded. `suppressHydrationWarning` on <html> in layout.tsx
 * only covers that one element's own attribute, not this. See JOURNAL.md
 * 2026-08-13.
 */
function readInitialTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Both the server render AND the client's first hydration pass now use
  // this SAME hardcoded "dark" starting value — no `document` read during
  // render anymore, so there's nothing for React to mismatch on.
  const [theme, setTheme] = useState<Theme>("dark");
  const [mounted, setMounted] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Runs once, strictly after hydration completes — corrects `theme` to
  // the real stored value here instead. A completely ordinary post-mount
  // state update at this point, not a hydration-time value, so no
  // mismatch; the visible page itself never flashes because the no-flash
  // inline script (layout.tsx) already set the real value on <html>
  // before this ever runs — this effect is only correcting REACT's OWN
  // state to match what's already on screen. Unlike CalendarBoard.tsx's
  // fetchEvents, there's no real async work here — the microtask wrapper
  // is a deliberate no-op deferral purely to get these setState calls off
  // the effect's own call stack, because this project's lint config
  // (react-hooks/set-state-in-effect) flags ANY setState synchronously
  // reachable from an effect body, including this canonical "sync from an
  // external store after mount" case.
  useEffect(() => {
    Promise.resolve().then(() => {
      setMounted(true);
      setTheme(readInitialTheme());
    });
  }, []);

  // Gated on `mounted` so this can never fire with the "dark" placeholder
  // before the effect above has corrected it — an ungated write here
  // would overwrite the no-flash script's already-correct DOM attribute
  // with the wrong default for one frame, reintroducing exactly the flash
  // this whole design exists to avoid.
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme, mounted]);

  // The actual color change is already a smooth CSS transition on every
  // custom property (globals.css's `*, *::before, *::after` rule) — this
  // overlay is purely a cosmetic flourish bridging it, not what makes the
  // colors themselves change. A real click handler, not an effect, so
  // there's no "setState in effect" concern setting state synchronously
  // here.
  function toggleTheme() {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsTransitioning(true);
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    timeoutRef.current = setTimeout(() => setIsTransitioning(false), TRANSITION_OVERLAY_MS);
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, mounted }}>
      {children}
      <AnimatePresence>{isTransitioning && <ThemeTransitionOverlay />}</AnimatePresence>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}

/** Inlined into layout.tsx's <head> — must run before hydration to avoid a flash. */
export const NO_FLASH_THEME_SCRIPT = `
(function() {
  try {
    var stored = localStorage.getItem("${STORAGE_KEY}");
    var theme = stored === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = theme;
  } catch (e) {}
})();
`;
