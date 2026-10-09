import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrastRatio, readThemeTokens } from "./contrast.ts";

test("contrastRatio matches the WCAG reference values", () => {
  assert.equal(contrastRatio("#000000", "#ffffff").toFixed(2), "21.00");
  assert.equal(contrastRatio("#ffffff", "#ffffff").toFixed(2), "1.00");
  assert.equal(contrastRatio("#777777", "#ffffff").toFixed(2), "4.48");
});

const css = readFileSync(new URL("../../app/globals.css", import.meta.url), "utf8");
const themes = readThemeTokens(css);

// [foreground token, background token, minimum ratio, why]
const PAIRS: [string, string, number, string][] = [
  ["--ink", "--bg", 4.5, "body text on page"],
  ["--ink", "--panel", 4.5, "body text on cards"],
  ["--ink-soft", "--bg", 4.5, "secondary text on page"],
  ["--ink-soft", "--panel", 4.5, "secondary text on cards"],
  ["--link", "--bg", 4.5, "links on page"],
  ["--link", "--panel", 4.5, "links on cards"],
  ["--on-cobalt", "--cobalt", 4.5, "text on primary buttons"],
  ["--on-sun", "--sun", 4.5, "text on yellow"],
  ["--hazard-ink", "--sun", 4.5, "hazard tape stripes against the yellow stripes and selected text"],
  ["--on-bubblegum", "--bubblegum", 4.5, "text on pink"],
  ["--on-danger", "--danger", 4.5, "text on danger buttons"],
  ["--danger-ink", "--bg", 4.5, "error text on page"],
  ["--danger-ink", "--panel", 4.5, "error text on cards"],
  ["--line", "--bg", 3, "outlines against page (non-text)"],
  ["--line", "--panel", 3, "outlines against cards (non-text)"],
];

// Focus ring = 3px --ink outline + 6px --sun outer ring (globals.css).
// Light: the yellow ring alone is too faint on cream, so the ink ring must contrast with the sun ring.
// Dark: ink (cream) and sun (yellow) are both light, so the two rings can never be 3:1 apart without
// turning the yellow brown (ink on #ffd23f is 1.27:1). The dark ring is instead judged by what it sits
// on: the cream ring and the yellow ring must each be 3:1 against the dark page.
const FOCUS_PAIRS: Record<"dark" | "light", [string, string, number, string][]> = {
  light: [["--ink", "--sun", 3, "focus ring inner ring against its yellow outer ring (non-text)"]],
  dark: [
    ["--ink", "--bg", 3, "focus ring inner ring against the page (non-text)"],
    ["--sun", "--bg", 3, "focus ring outer ring against the page (non-text)"],
    ["--ink", "--panel", 3, "focus ring inner ring against cards (non-text)"],
    ["--sun", "--panel", 3, "focus ring outer ring against cards (non-text)"],
  ],
};

for (const theme of ["dark", "light"] as const) {
  for (const [fg, bg, min, why] of [...PAIRS, ...FOCUS_PAIRS[theme]]) {
    test(`${theme}: ${fg} on ${bg} is at least ${min}:1 (${why})`, () => {
      const t = themes[theme];
      assert.ok(t[fg], `${fg} missing in ${theme} theme`);
      assert.ok(t[bg], `${bg} missing in ${theme} theme`);
      const ratio = contrastRatio(t[fg], t[bg]);
      assert.ok(ratio >= min, `${t[fg]} on ${t[bg]} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
    });
  }
}
