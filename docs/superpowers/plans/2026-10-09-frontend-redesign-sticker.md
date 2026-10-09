# Enagram.io STICKER Frontend Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the look and layout of the chat screen, login screen and calendar page with the owner-approved "STICKER" poster / neo-brutalist design, in dark and light themes, without changing any behaviour.

**Architecture:** One token layer (CSS variables in `globals.css`, light + dark), a small set of shared presentational parts in `src/app/ui/`, pure presentation logic in `src/lib/ui/` (unit-tested with `node --test`), and existing screens re-composed around them. A development-only `/design` route renders every state with fixture data so the look can be verified by screenshots without signing in.

**Tech Stack:** Next.js 16.2.12 (App Router), React 19.2.4, Tailwind 4.3.3 (CSS-first `@theme inline`), framer-motion 13, lucide-react, react-markdown, fonts via `next/font/google`. No new runtime dependency.

**Spec:** `docs/superpowers/specs/2026-10-09-frontend-redesign-sticker-design.md` (binding authority; this plan argues from it).

## Global Constraints

- **Project note:** `AGENTS.md` says this Next.js has breaking changes; read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code (fonts, routes, `notFound`).
- **No behaviour changes.** API routes, sync logic (`src/app/syncClient.ts`, `src/lib/sync/*`), search, auth (`src/auth.ts`), the approval logic (`src/lib/query/approval.ts`, `src/app/chat/approvalView.ts`), database code and every existing test stay as they are. Props and data flow are passed through; components are re-skinned and re-composed. Where this plan changes a component's props it says so explicitly.
- **Existing tests must keep passing** (231 at the time of writing) plus the new ones. `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` must all pass at the end of every task.
- **Pure modules** (anything under `src/lib/ui/` and any `*.ts` that has a test) import only with relative paths and explicit `.ts` extensions, never `@/` aliases, React, or `next/*`, so `node --test` runs them directly. Test files use `node:test` and `node:assert/strict`.
- **Lint rule to respect:** `react-hooks/set-state-in-effect` flags any `setState` reachable synchronously from an effect body; start async work from the effect and call setters only inside `.then()` callbacks (see `DbStatusBanner.tsx`, `ThemeProvider.tsx`).
- **Visual rules (spec 4.1):** 2.5px solid `--line` outline on every surface; hard offset shadow with no blur; flat colour only (no gradient, blur, glass, grain); radius 4px for cards/fields and full pill for chips/tags; pressable = hover to the larger shadow, press translates into the shadow; only decorative stickers tilt (max 1deg hover, 2deg while dragging), never reading surfaces; `prefers-reduced-motion` disables rotation/spring motion.
- **Palette (starting values, the contrast test sets the final ones, spec 4.2):** dark (default) bg `#121212`, panel `#1b1b1b`, ink `#f5f0e6`, cobalt `#4a5bff`, sun `#ffd23f`, bubblegum `#ff7ab8`, danger `#ff6a5c`; light bg `#fbf4e4`, panel `#fffaf0`, ink `#111111`, cobalt `#2a3bff`, sun `#ffd23f`, bubblegum `#ff7ab8`, danger `#ff4d3d`, danger text `#c4220f`.
- **Type (spec 4.3):** display = Archivo variable, width axis wide, weight 900, uppercase, tight leading; body = DM Sans 16px / 1.55; annotation = Caveat (short handwritten notes only).
- **Accessibility (spec 4.4):** WCAG AA contrast for every text/background token pair in both themes (enforced by a test), 44px minimum touch targets, visible focus ring, `aria-live="polite"` on the tape strip, status never conveyed by colour alone.
- **Not copied from the owner's portfolio:** no lime or orange-red palette, no film grain, no corner-bracket "detection box", no mono-caps-everywhere labels, no row-index layout.
- **Branch and attribution:** all work on branch `redesign`; `main` is not touched. Commits are authored by the already-configured git identity (Priyanshu Kumar Tiwari <143282195+Halok600@users.noreply.github.com>) and must contain NO `Co-Authored-By`, NO "Generated with Claude Code" line, no attribution of any kind. Never push; never change git config; no `rm -rf`; temp files in the session scratchpad; no personal data (names, emails, employers) in code, fixtures or docs.

## Rulings made while planning

- **Focus ring (amends spec 4.1 rule 5):** sun yellow on cream fails the 3:1 non-text contrast requirement in light mode. The ring is therefore a 3px solid `--ink` outline with a 3px `--sun` outer ring (`outline: 3px solid var(--ink); outline-offset: 2px; box-shadow: 0 0 0 6px var(--sun)`); it contrasts in both themes.
- **Source colours:** the existing source model only has Gmail and Drive tools (`Source["tool"]`), so tickets are Gmail = cobalt, Drive = sun. No calendar source type is invented.
- **Legacy token bridge:** components that are re-skinned in later tasks still reference the old variable names. Task 1 keeps a clearly labelled "legacy bridge" block mapping old names to new tokens so the app stays presentable between tasks; Task 8 deletes it after confirming nothing references it.
- **Default theme stays dark** (the existing no-flash script and `ThemeProvider` default are unchanged); light is `:root[data-theme="light"]`.
- **Mockup refinements (the owner supplied a concept board on 2026-10-09; it is the visual target):** tape strip = full-bleed hazard band tilted -1deg with a lucide `TriangleAlert` icon; top bar = square logo mark, service chips with plain lucide line icons (never the real Gmail/Drive logos), a handwritten `N docs indexed` note, a sun/moon switch for the theme, and a plain-text Disconnect; source tickets = notched, perforated stubs with the number badge on the right; message cards get small speech-bubble tails; the approval card has a hazard-stripe frame all the way round; calendar = dark weekday header row, events as thin colour bars with the title, a small TODAY tag on today's cell; event editor = paper sheet with a folded corner. The cork-board background in the concept board is part of the mock-up only and is not built.
- **Preview moved up:** the `/design` route and the screenshot script are built in Task 3, and every later task adds its own views and produces screenshots (in the git-ignored `design-shots/` folder) so the owner sees real pictures early.
- **Chat error and retry** move from inside the transcript into the tape strip (spec 5.1): `Chat` loses its `systemError` / `onRetry` props and `Workspace` renders the tape.

## File Structure

Create:
- `src/lib/ui/contrast.ts`, `contrast.test.ts` (WCAG ratio + a tokens-from-CSS reader used only by the test)
- `src/lib/ui/event-color.ts`, `event-color.test.ts`
- `src/lib/ui/tape.ts`, `tape.test.ts` (which status messages the tape strip shows, in priority order)
- `src/lib/ui/tool-label.ts`, `tool-label.test.ts`
- `src/lib/ui/greeting.ts`, `greeting.test.ts` (first name, suggestion prompts)
- `src/lib/ui/health.ts`, `health.test.ts` (`/api/health` JSON to a UI state)
- `src/lib/ui/sync-line.ts`, `sync-line.test.ts` (the sync result sentence)
- `src/app/ui/StickerButton.tsx`, `Chip.tsx`, `Card.tsx`, `Stamp.tsx`, `Switch.tsx`, `Field.tsx`, `TapeStrip.tsx`, `Ticket.tsx`, `WorkingTicker.tsx`, `TopBar.tsx`
- `src/app/useHealth.ts`, `src/app/useSync.ts` (thin client hooks)
- `src/app/design/page.tsx`, `src/app/design/DesignPreview.tsx`, `src/app/design/fixtures.ts`
- `scripts/design-shots.mjs` (screenshot runner for `/design`)

Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx` (login), `src/app/chat/Workspace.tsx`, `Chat.tsx`, `EmptyState.tsx`, `MessageBubble.tsx`, `ApprovalCard.tsx`, `ThemeToggle.tsx`, `src/app/SyncButton.tsx`, `src/app/calendar/page.tsx`, `CalendarBoard.tsx`, `EventModal.tsx`, `README.md`.

Delete (Task 8, after nothing imports them): `src/app/chat/Sidebar.tsx`, `HeroLogo.tsx`, `ThinkingIndicator.tsx`, `SourceChip.tsx` (its `Source` type moves into `src/app/chat/source.ts`), `DbStatusBanner.tsx`, `SystemErrorBanner.tsx`.

---

### Task 1: Tokens, fonts, themes, and the contrast gate

**Files:**
- Modify: `src/app/globals.css` (full rewrite, keep the scrollbar and selection ideas), `src/app/layout.tsx`
- Create: `src/lib/ui/contrast.ts`, `src/lib/ui/contrast.test.ts`

**Interfaces:**
- Produces (CSS variables, used by every later task): `--bg --panel --ink --ink-soft --line --cobalt --on-cobalt --link --sun --on-sun --bubblegum --on-bubblegum --danger --on-danger --danger-ink --shadow-color --shadow-hard --shadow-hard-lg --shadow-hard-sm --stroke --radius-card --radius-pill`; fonts `--font-display --font-sans --font-hand`; utility classes `.font-display` (Archivo wide 900 uppercase tight), `.font-hand` (Caveat); `.focus-ring` behaviour applied globally to `:focus-visible`.
- Produces (TS): `contrastRatio(a: string, b: string): number`, `readThemeTokens(css: string): { dark: Record<string,string>; light: Record<string,string> }`.

- [ ] **Step 1: Write the contrast helper and its failing test**

`src/lib/ui/contrast.ts`:

```ts
/** WCAG 2.x contrast helpers. Pure, no dependencies. Colours are "#rrggbb". */

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

export function hexToRgb(hex: string): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) throw new Error(`Not a #rrggbb colour: ${hex}`);
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/**
 * Reads `--name: #rrggbb;` declarations from the two theme blocks of globals.css:
 * the block whose selector starts with `:root, :root[data-theme="dark"]` (dark, the default)
 * and the block `:root[data-theme="light"]`. Used only by the contrast test, so the CSS stays
 * the single source of truth for the palette.
 */
export function readThemeTokens(css: string): { dark: Record<string, string>; light: Record<string, string> } {
  function block(selectorStart: string): Record<string, string> {
    const start = css.indexOf(selectorStart);
    if (start < 0) throw new Error(`Selector not found in CSS: ${selectorStart}`);
    const open = css.indexOf("{", start);
    const close = css.indexOf("}", open);
    const body = css.slice(open + 1, close);
    const out: Record<string, string> = {};
    for (const m of body.matchAll(/(--[a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{6})\s*;/g)) out[m[1]] = m[2];
    return out;
  }
  return { dark: block(':root, :root[data-theme="dark"]'), light: block(':root[data-theme="light"]') };
}
```

`src/lib/ui/contrast.test.ts`:

```ts
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
  ["--on-bubblegum", "--bubblegum", 4.5, "text on pink"],
  ["--on-danger", "--danger", 4.5, "text on danger buttons"],
  ["--danger-ink", "--bg", 4.5, "error text on page"],
  ["--danger-ink", "--panel", 4.5, "error text on cards"],
  ["--line", "--bg", 3, "outlines against page (non-text)"],
  ["--line", "--panel", 3, "outlines against cards (non-text)"],
  ["--ink", "--sun", 3, "focus ring inner ring against its yellow outer ring (non-text)"],
];

for (const theme of ["dark", "light"] as const) {
  for (const [fg, bg, min, why] of PAIRS) {
    test(`${theme}: ${fg} on ${bg} is at least ${min}:1 (${why})`, () => {
      const t = themes[theme];
      assert.ok(t[fg], `${fg} missing in ${theme} theme`);
      assert.ok(t[bg], `${bg} missing in ${theme} theme`);
      const ratio = contrastRatio(t[fg], t[bg]);
      assert.ok(ratio >= min, `${t[fg]} on ${t[bg]} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
    });
  }
}
```

- [ ] **Step 2: Run it to see it fail**

Run: `node --test src/lib/ui/contrast.test.ts`
Expected: the first test passes; the theme tests fail because the old `globals.css` has no such tokens ("Selector not found" or "--ink missing").

- [ ] **Step 3: Rewrite `src/app/globals.css`**

Start from this (adjust hex values until Step 4 passes; keep the structure and names exactly):

```css
@import "tailwindcss";

/* STICKER theme. Dark is the default (the no-flash script sets data-theme="dark" or "light" before paint). */
:root, :root[data-theme="dark"] {
  --bg: #121212;
  --panel: #1b1b1b;
  --ink: #f5f0e6;
  --ink-soft: #b9b3a6;
  --line: #f5f0e6;
  --cobalt: #4a5bff;
  --on-cobalt: #ffffff;
  --link: #8d99ff;
  --sun: #ffd23f;
  --on-sun: #111111;
  --bubblegum: #ff7ab8;
  --on-bubblegum: #111111;
  --danger: #ff6a5c;
  --on-danger: #111111;
  --danger-ink: #ff8f84;
  --shadow-color: #4a5bff;
  color-scheme: dark;
}

:root[data-theme="light"] {
  --bg: #fbf4e4;
  --panel: #fffaf0;
  --ink: #111111;
  --ink-soft: #4a463d;
  --line: #111111;
  --cobalt: #2a3bff;
  --on-cobalt: #ffffff;
  --link: #2a3bff;
  --sun: #ffd23f;
  --on-sun: #111111;
  --bubblegum: #ff7ab8;
  --on-bubblegum: #111111;
  --danger: #ff4d3d;
  --on-danger: #111111;
  --danger-ink: #c4220f;
  --shadow-color: #111111;
  color-scheme: light;
}

:root {
  --stroke: 2.5px;
  --radius-card: 4px;
  --radius-pill: 999px;
  --shadow-hard: 4px 4px 0 var(--shadow-color);
  --shadow-hard-lg: 6px 6px 0 var(--shadow-color);
  --shadow-hard-sm: 1px 1px 0 var(--shadow-color);
}

@theme inline {
  --color-background: var(--bg);
  --color-foreground: var(--ink);
  --font-sans: var(--font-sans), system-ui, sans-serif;
  --font-display: var(--font-display), "Archivo Black", Impact, sans-serif;
  --font-hand: var(--font-hand), "Comic Sans MS", cursive;
}

html, body { height: 100%; }
body { background: var(--bg); color: var(--ink); font-family: var(--font-sans), system-ui, sans-serif; font-size: 16px; line-height: 1.55; }

.font-display { font-family: var(--font-display), "Archivo Black", Impact, sans-serif; font-weight: 900; font-stretch: 125%; text-transform: uppercase; letter-spacing: -0.02em; line-height: 0.92; }
.font-hand { font-family: var(--font-hand), cursive; line-height: 1.1; }

::selection { background: var(--sun); color: #111111; }

:focus-visible { outline: 3px solid var(--ink); outline-offset: 2px; box-shadow: 0 0 0 6px var(--sun); }

/* Hazard tape used by the tape strip and the working ticker. */
.hazard { background: repeating-linear-gradient(-45deg, var(--sun) 0 14px, #111111 14px 28px); }

@keyframes ticker { from { transform: translateX(0); } to { transform: translateX(-50%); } }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.001ms !important; animation-iteration-count: 1 !important; transition-duration: 0.001ms !important; scroll-behavior: auto !important; }
}

/* ---- LEGACY BRIDGE: old variable names mapped to new tokens so un-migrated components stay presentable.
   Deleted in Task 8 once nothing references them. ---- */
:root {
  --bg-panel: var(--panel);
  --bg-panel-raised: var(--panel);
  --bg-sidebar: var(--panel);
  --accent: var(--link);
  --accent-strong: var(--cobalt);
  --accent-soft-bg: var(--panel);
  --text-primary: var(--ink);
  --text-secondary: var(--ink-soft);
  --text-tertiary: var(--ink-soft);
  --border: var(--line);
  --border-strong: var(--line);
  --danger-soft-bg: var(--panel);
  --success: var(--link);
  --shadow-sm: var(--shadow-hard-sm);
  --shadow-md: var(--shadow-hard);
  --radius-sm: var(--radius-card);
  --radius-md: var(--radius-card);
  --radius-lg: var(--radius-card);
  --selection-text: #111111;
}
```

Keep the existing scrollbar styling and the old `.thinking-*` rules until Task 6 deletes `ThinkingIndicator` (do not remove them now).

- [ ] **Step 4: Run the contrast test until it passes**

Run: `node --test src/lib/ui/contrast.test.ts`
Expected: all PASS. If a pair fails, change the hex value of the foreground or background token (not the minimum) until it passes, and keep the palette recognisable (cream/ink/cobalt/sun/bubblegum).

- [ ] **Step 5: Fonts in `src/app/layout.tsx`**

Replace the `Inter`/`Space_Grotesk` imports with (confirm names and options against `node_modules/next/dist/docs` for `next/font/google`):

```tsx
import { Archivo, DM_Sans, Caveat } from "next/font/google";

const displayFont = Archivo({ variable: "--font-display", subsets: ["latin"], axes: ["wdth"], display: "swap" });
const sansFont = DM_Sans({ variable: "--font-sans", subsets: ["latin"], display: "swap" });
const handFont = Caveat({ variable: "--font-hand", subsets: ["latin"], display: "swap" });
```

Apply `${displayFont.variable} ${sansFont.variable} ${handFont.variable}` in the `<html className=...>`. Keep the no-flash script, `ThemeProvider`, `PageTransition` and `suppressHydrationWarning` exactly as they are. If `axes: ["wdth"]` is rejected by the build for Archivo, fall back to `Archivo_Black` for `--font-display` and record that in the task report (spec 4.3 allows it).

- [ ] **Step 6: Verify and commit**

Run: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` (all must pass).

```bash
git add src/app/globals.css src/app/layout.tsx src/lib/ui/contrast.ts src/lib/ui/contrast.test.ts
git commit -m "Add the STICKER tokens, fonts and a contrast gate for both themes"
```

---

### Task 2: Pure presentation helpers

**Files:**
- Create: `src/lib/ui/event-color.ts`, `tape.ts`, `tool-label.ts`, `greeting.ts`, `health.ts`, `sync-line.ts` and one `*.test.ts` beside each.

**Interfaces (produced, used by Tasks 3-8; signatures are binding):**
- `event-color.ts`: `type EventColor = "cobalt" | "sun" | "bubblegum"`; `EVENT_COLORS: readonly EventColor[]`; `eventColor(id: string): EventColor` (stable hash of the id).
- `tape.ts`: `type TapeTone = "alert" | "working" | "ok" | "warn"`; `type TapeItem = { id: string; tone: TapeTone; text: string; retry?: boolean }`; `type TapeInput = { dbMessage?: string | null; chatError?: string | null; sync: { state: "idle" | "loading" | "done" | "error"; progress?: string | null; waiting?: string | null; result?: string | null; stop?: string | null; error?: string | null } }`; `selectTapeItems(input: TapeInput): TapeItem[]`.
- `tool-label.ts`: `toolLabel(name: string): string`; `tickerText(names: readonly string[]): string`.
- `greeting.ts`: `firstName(name?: string): string | null`; `SUGGESTIONS: readonly { id: string; text: string; kind: "mail" | "calendar" | "files" | "reply" }[]` (exactly four).
- `health.ts`: `type HealthView = { status: "loading" | "ok" | "down" | "unreachable"; documents: number | null }`; `healthToView(json: unknown): HealthView`; `HEALTH_LOADING: HealthView`; `HEALTH_UNREACHABLE: HealthView`.
- `sync-line.ts`: `syncResultLine(r: { counts?: { gmail: number; drive: number; calendar: number }; documents: number; changed: number }): string`.

- [ ] **Step 1: Write the failing tests**

`event-color.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { EVENT_COLORS, eventColor } from "./event-color.ts";

test("the same id always gets the same colour", () => {
  assert.equal(eventColor("abc123"), eventColor("abc123"));
});

test("colours come from the palette and all three get used across many ids", () => {
  const seen = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const c = eventColor(`event-${i}`);
    assert.ok(EVENT_COLORS.includes(c));
    seen.add(c);
  }
  assert.equal(seen.size, 3);
});

test("an empty id still returns a valid colour", () => {
  assert.ok(EVENT_COLORS.includes(eventColor("")));
});
```

`tape.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { selectTapeItems } from "./tape.ts";

const idle = { state: "idle" as const };

test("nothing to say gives an empty strip", () => {
  assert.deepEqual(selectTapeItems({ sync: idle }), []);
});

test("a database problem comes first, then a chat error with Retry, then sync lines", () => {
  const items = selectTapeItems({
    dbMessage: "The database is paused.",
    chatError: "Model is busy.",
    sync: { state: "loading", progress: "12 document(s) left to index..." },
  });
  assert.deepEqual(items.map((i) => i.id), ["db", "chat-error", "sync-progress"]);
  assert.equal(items[0].tone, "alert");
  assert.equal(items[1].retry, true);
  assert.equal(items[2].tone, "working");
});

test("while syncing, progress and the waiting note both show and the finished line does not", () => {
  const items = selectTapeItems({
    sync: { state: "loading", progress: "5 left", waiting: "Waiting 40s", result: "old result" },
  });
  assert.deepEqual(items.map((i) => i.id), ["sync-progress", "sync-waiting"]);
});

test("a finished sync shows its result and any stop warning (warning is a warn tone)", () => {
  const items = selectTapeItems({ sync: { state: "done", result: "1 email(s) -> 3 document(s).", stop: "Gemini limit reached." } });
  assert.deepEqual(items.map((i) => [i.id, i.tone]), [["sync-result", "ok"], ["sync-stop", "warn"]]);
});

test("a failed sync shows its error as an alert", () => {
  const items = selectTapeItems({ sync: { state: "error", error: "Sync failed" } });
  assert.deepEqual(items.map((i) => [i.id, i.tone, i.text]), [["sync-error", "alert", "Sync failed"]]);
});

test("blank strings are ignored", () => {
  assert.deepEqual(selectTapeItems({ dbMessage: "  ", chatError: "", sync: idle }), []);
});
```

`tool-label.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { tickerText, toolLabel } from "./tool-label.ts";

test("known tools have short uppercase labels", () => {
  assert.equal(toolLabel("search_gmail"), "SEARCHING GMAIL");
  assert.equal(toolLabel("delete_calendar_event"), "DELETING AN EVENT");
});

test("unknown tools get a generic label", () => {
  assert.equal(toolLabel("something_new"), "WORKING");
});

test("ticker joins unique labels and falls back when nothing is running", () => {
  assert.equal(tickerText(["search_gmail", "search_drive", "search_gmail"]), "SEARCHING GMAIL  •  SEARCHING DRIVE");
  assert.equal(tickerText([]), "THINKING");
});
```

`greeting.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { SUGGESTIONS, firstName } from "./greeting.ts";

test("firstName takes the first word, trimmed", () => {
  assert.equal(firstName("  Priyanshu Kumar Tiwari "), "Priyanshu");
});

test("firstName returns null for missing or blank names", () => {
  assert.equal(firstName(undefined), null);
  assert.equal(firstName("   "), null);
});

test("there are exactly four generic suggestions with unique ids and no personal names", () => {
  assert.equal(SUGGESTIONS.length, 4);
  assert.equal(new Set(SUGGESTIONS.map((s) => s.id)).size, 4);
  for (const s of SUGGESTIONS) assert.ok(s.text.length > 8 && s.text.length < 60);
});
```

`health.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { HEALTH_LOADING, HEALTH_UNREACHABLE, healthToView } from "./health.ts";

test("an ok response carries the document count", () => {
  assert.deepEqual(healthToView({ db: "ok", documents: 163, lastSyncedAt: "x" }), { status: "ok", documents: 163 });
});

test("a down response has no count", () => {
  assert.deepEqual(healthToView({ db: "down", reason: "paused" }), { status: "down", documents: null });
});

test("garbage is treated as unreachable and a non-number count as null", () => {
  assert.deepEqual(healthToView(null), HEALTH_UNREACHABLE);
  assert.deepEqual(healthToView("nope"), HEALTH_UNREACHABLE);
  assert.deepEqual(healthToView({ db: "ok", documents: "many" }), { status: "ok", documents: null });
  assert.equal(HEALTH_LOADING.status, "loading");
});
```

`sync-line.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { syncResultLine } from "./sync-line.ts";

test("full result with counts and changes", () => {
  assert.equal(
    syncResultLine({ counts: { gmail: 100, drive: 61, calendar: 2 }, documents: 163, changed: 5 }),
    "100 email(s) + 61 file(s) + 2 event(s) → 163 document(s), 5 updated.",
  );
});

test("no changes and no counts", () => {
  assert.equal(syncResultLine({ documents: 163, changed: 0 }), "163 document(s) (no changes).");
});
```

- [ ] **Step 2: Run to see them fail**

Run: `node --test src/lib/ui/*.test.ts`
Expected: FAIL (modules not found).

- [ ] **Step 3: Implement the helpers**

`event-color.ts`:

```ts
export type EventColor = "cobalt" | "sun" | "bubblegum";
export const EVENT_COLORS: readonly EventColor[] = ["cobalt", "sun", "bubblegum"];

/** Stable colour per event id so an event keeps its colour across renders and reloads. */
export function eventColor(id: string): EventColor {
  let h = 0;
  for (const ch of id) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return EVENT_COLORS[h % EVENT_COLORS.length];
}
```

`tape.ts`:

```ts
export type TapeTone = "alert" | "working" | "ok" | "warn";
export type TapeItem = { id: string; tone: TapeTone; text: string; retry?: boolean };
export type TapeInput = {
  dbMessage?: string | null;
  chatError?: string | null;
  sync: {
    state: "idle" | "loading" | "done" | "error";
    progress?: string | null;
    waiting?: string | null;
    result?: string | null;
    stop?: string | null;
    error?: string | null;
  };
};

const has = (s: string | null | undefined): s is string => typeof s === "string" && s.trim().length > 0;

/** Which status lines the tape strip shows, in priority order. Empty array = the strip is hidden. */
export function selectTapeItems({ dbMessage, chatError, sync }: TapeInput): TapeItem[] {
  const items: TapeItem[] = [];
  if (has(dbMessage)) items.push({ id: "db", tone: "alert", text: dbMessage });
  if (has(chatError)) items.push({ id: "chat-error", tone: "alert", text: chatError, retry: true });
  if (sync.state === "error" && has(sync.error)) items.push({ id: "sync-error", tone: "alert", text: sync.error });
  if (sync.state === "loading") {
    if (has(sync.progress)) items.push({ id: "sync-progress", tone: "working", text: sync.progress });
    if (has(sync.waiting)) items.push({ id: "sync-waiting", tone: "working", text: sync.waiting });
  }
  if (sync.state === "done") {
    if (has(sync.result)) items.push({ id: "sync-result", tone: "ok", text: sync.result });
    if (has(sync.stop)) items.push({ id: "sync-stop", tone: "warn", text: sync.stop });
  }
  return items;
}
```

`tool-label.ts`:

```ts
const LABELS: Record<string, string> = {
  search_gmail: "SEARCHING GMAIL",
  search_drive: "SEARCHING DRIVE",
  search_calendar: "CHECKING CALENDAR",
  draft_gmail_reply: "DRAFTING A REPLY",
  save_preference: "SAVING A PREFERENCE",
  forget_preference: "FORGETTING A PREFERENCE",
  find_related: "FINDING RELATED ITEMS",
  create_calendar_event: "CREATING AN EVENT",
  update_calendar_event: "UPDATING AN EVENT",
  delete_calendar_event: "DELETING AN EVENT",
};

export function toolLabel(name: string): string {
  return LABELS[name] ?? "WORKING";
}

export function tickerText(names: readonly string[]): string {
  const labels = [...new Set(names.map(toolLabel))];
  return labels.length === 0 ? "THINKING" : labels.join("  •  ");
}
```

`greeting.ts`:

```ts
export function firstName(name?: string): string | null {
  return name?.trim().split(/\s+/)[0] || null;
}

export const SUGGESTIONS: readonly { id: string; text: string; kind: "mail" | "calendar" | "files" | "reply" }[] = [
  { id: "mail", text: "Summarise my recent emails", kind: "mail" },
  { id: "calendar", text: "What's on my calendar this week?", kind: "calendar" },
  { id: "files", text: "Find my latest Drive files", kind: "files" },
  { id: "reply", text: "What needs a reply?", kind: "reply" },
];
```

`health.ts`:

```ts
export type HealthView = { status: "loading" | "ok" | "down" | "unreachable"; documents: number | null };
export const HEALTH_LOADING: HealthView = { status: "loading", documents: null };
export const HEALTH_UNREACHABLE: HealthView = { status: "unreachable", documents: null };

export function healthToView(json: unknown): HealthView {
  if (!json || typeof json !== "object") return HEALTH_UNREACHABLE;
  const { db, documents } = json as { db?: unknown; documents?: unknown };
  if (db === "ok") return { status: "ok", documents: typeof documents === "number" ? documents : null };
  if (db === "down") return { status: "down", documents: null };
  return HEALTH_UNREACHABLE;
}
```

`sync-line.ts`:

```ts
export function syncResultLine(r: {
  counts?: { gmail: number; drive: number; calendar: number };
  documents: number;
  changed: number;
}): string {
  const counts = r.counts ? `${r.counts.gmail} email(s) + ${r.counts.drive} file(s) + ${r.counts.calendar} event(s) → ` : "";
  const changed = r.changed > 0 ? `, ${r.changed} updated` : " (no changes)";
  return `${counts}${r.documents} document(s)${changed}.`;
}
```

- [ ] **Step 4: Run to see them pass**

Run: `node --test src/lib/ui/*.test.ts` then `npm test`
Expected: PASS (all).

- [ ] **Step 5: Commit**

```bash
git add src/lib/ui
git commit -m "Add the pure presentation helpers: event colour, tape messages, tool labels, greeting, health view, sync line"
```

---

### Task 3: Shared sticker parts

**Files:**
- Create: `src/app/ui/StickerButton.tsx`, `Chip.tsx`, `Card.tsx`, `Stamp.tsx`, `Switch.tsx`, `Field.tsx`, `TapeStrip.tsx`, `Ticket.tsx`, `WorkingTicker.tsx`
- Create (moved up from Task 8): `src/app/design/page.tsx`, `src/app/design/DesignPreview.tsx`, `src/app/design/fixtures.ts`, `scripts/design-shots.mjs`; modify `.gitignore` (add `design-shots/`)

**Interfaces (produced; binding for Tasks 4-8; all are presentational client-safe components, typed props, no data fetching, all colours via tokens):**

```ts
// StickerButton.tsx
export function StickerButton(props: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  tone?: "cobalt" | "sun" | "bubblegum" | "danger" | "plain";   // default "plain"
  size?: "md" | "lg";                                           // md = min-h 44px, lg = min-h 56px
}): JSX.Element;
// Chip.tsx — pill with outline; optional as="a" for links; tilts up to 1deg on hover
export function Chip(props: { tone?: "cobalt" | "sun" | "bubblegum" | "plain"; href?: string; onClick?: () => void; disabled?: boolean; icon?: React.ReactNode; children: React.ReactNode; className?: string }): JSX.Element;
// Card.tsx — panel with 2.5px outline, radius 4px, hard shadow
export function Card(props: { as?: "div" | "section" | "article"; shadow?: "none" | "sm" | "md" | "lg"; tone?: "panel" | "sun" | "cobalt" | "bubblegum"; className?: string; children: React.ReactNode } & React.HTMLAttributes<HTMLElement>): JSX.Element;
// Stamp.tsx — small rotated label ("BRAIN", "TODAY"); decorative tilt -2deg
export function Stamp(props: { tone?: "cobalt" | "sun" | "bubblegum" | "plain"; children: React.ReactNode; className?: string }): JSX.Element;
// Switch.tsx — chunky switch built on a real checkbox input (keyboard + screen-reader accessible)
export function Switch(props: { checked: boolean; onChange: (checked: boolean) => void; label: string; id?: string }): JSX.Element;
// Field.tsx — label + thick-outlined input/textarea with the yellow focus shadow
export function Field(props: { label: string; id: string; multiline?: boolean } & (React.InputHTMLAttributes<HTMLInputElement> | React.TextareaHTMLAttributes<HTMLTextAreaElement>)): JSX.Element;
// TapeStrip.tsx — renders TapeItem[] from src/lib/ui/tape.ts; returns null when empty
export function TapeStrip(props: { items: TapeItem[]; onRetry?: () => void }): JSX.Element | null;
// Ticket.tsx — source ticket stub (perforated left edge via CSS), number badge, truncated title; <a> when url present
export function Ticket(props: { n: number; title: string; tone: "cobalt" | "sun"; url?: string; score?: number }): JSX.Element;
// WorkingTicker.tsx — hazard-tape ticker marquee with role="status"; text from tickerText()
export function WorkingTicker(props: { names: readonly string[] }): JSX.Element;
```

Visual requirements (apply to every part): outline `var(--stroke) solid var(--line)`; fill from tokens (`bg-[var(--cobalt)] text-[var(--on-cobalt)]` etc.); shadows `var(--shadow-hard)` / `-lg` / `-sm`; pressable parts use `framer-motion` `whileHover={{ x: -1, y: -1 }}` + larger shadow and `whileTap={{ x: 3, y: 3 }}` + `--shadow-hard-sm` (a spring "thunk": `type: "spring", stiffness: 500, damping: 30`), disabled = 45% opacity and no motion; rotation only on `Chip`, `Stamp`, `Ticket`, never on `Card`/`Field`; use `useReducedMotion()` from framer-motion to drop rotation and springs; `TapeStrip` is a full-bleed band tilted -1deg (no tilt under reduced motion; the page container hides horizontal overflow) with a lucide `TriangleAlert` icon before each item, has `role="status" aria-live="polite"`, a hazard-stripe top/bottom border using the `.hazard` class, each item as a pill whose tone sets the fill (alert = `--danger`, working = `--sun`, ok = `--panel`, warn = `--bubblegum`) and a text prefix word so colour is never the only signal ("ALERT", "WORKING", "DONE", "HEADS UP"), and a Retry `StickerButton` on items with `retry`; `WorkingTicker` scrolls its text with the `ticker` keyframes (duplicate the text once for a seamless loop) and shows static text under reduced motion; `Ticket` is a notched, perforated stub (notches on the left and right edges via a CSS radial-gradient mask or pseudo-elements, a dashed perforation line before the number) with the number badge on the right, the title truncated with `title=` attribute, and `rel="noopener noreferrer" target="_blank"` on links.

- [ ] **Step 1:** Create each component per the interface and visual requirements above (one file each).
- [ ] **Step 2: Build the design preview and screenshot runner.** `/design` route: `page.tsx` is a server component that calls `notFound()` (from `next/navigation`) when `process.env.NODE_ENV === "production"`, otherwise renders `<DesignPreview theme view />` using the `theme` (`dark` | `light`, default dark) and `view` search params; `DesignPreview` (client) assigns `document.documentElement.dataset.theme` from `theme` inside an effect (a plain attribute assignment, no setState) and renders the requested view. In this task the only view is `kit`: every shared part side by side in all its tones and sizes (buttons, chips, cards, stamps, switch on/off, fields single/multi-line, tape strip with one item of each tone and a retry item, three tickets, a working ticker). `fixtures.ts` holds generic fixture data (no personal data). `scripts/design-shots.mjs` is a dependency-free Node script: for a base URL (default `http://localhost:3100`) it runs headless Chrome or Edge from the command line with an isolated `--user-data-dir` in the OS temp directory (never the owner's own browser profile, never the Playwright MCP) for each requested `view` (CLI arguments, default `kit`) x theme (dark, light) x size (1440x900, 390x844), using `--headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=<file> --window-size=WxH <url>`, and saves PNGs to `design-shots/<view>-<theme>-<WxH>.png`. Start `npm run dev -- -p 3100` in the background, run the script for `kit`, LOOK at the screenshots with the Read tool, fix every visible problem (clipped shadows, unreadable text, broken wrapping, missing fonts, notches not rendering), then stop the dev server.
- [ ] **Step 2b: Verify.** `npx tsc --noEmit`, `npm run lint`, `npm run build`. The parts have no pure logic of their own, so no unit tests here. Import the `TapeItem` type from `@/lib/ui/tape`.
- [ ] **Step 3:** Run `npm test` (all existing + Tasks 1-2 tests must pass).
- [ ] **Step 4: Commit**

```bash
git add src/app/ui
git commit -m "Add the shared sticker parts: button, chip, card, stamp, switch, field, tape strip, ticket, working ticker"
```

---

### Task 4: Top bar, health and sync hooks, and the chat shell

**Files:**
- Create: `src/app/ui/TopBar.tsx`, `src/app/useHealth.ts`, `src/app/useSync.ts`
- Modify: `src/app/chat/Workspace.tsx`, `src/app/chat/Chat.tsx` (props only), `src/app/SyncButton.tsx`, `src/app/chat/ThemeToggle.tsx`

**Interfaces:**
- Consumes: `healthToView`, `HEALTH_LOADING` (`src/lib/ui/health.ts`), `selectTapeItems` (`tape.ts`), `syncResultLine` (`sync-line.ts`), `TapeStrip`, `StickerButton`, `Chip`, `Stamp` (Task 3); existing `runFullSync`, `syncStopMessage`, `waitingMessage`, `FullSyncResult` (`src/app/syncClient.ts`); existing `dbProblemMessage`, `HEALTH_UNREACHABLE_MESSAGE` (`@/lib/db-errors`); existing `useTheme` from `ThemeProvider`.
- Produces:
  - `useHealth(): { view: HealthView; dbMessage: string | null }` — fetches `/api/health` once on mount (same logic as today's `DbStatusBanner`: `db === "down"` gives `dbProblemMessage(reason)`; a failed fetch gives `HEALTH_UNREACHABLE_MESSAGE`; healthy gives `null`). setState only inside `.then()`.
  - `useSync(): { state: "idle" | "loading" | "done" | "error"; progress: string | null; waiting: string | null; result: string | null; stop: string | null; error: string | null; run: () => Promise<void> }` — the exact behaviour of today's `SyncButton.handleSync` (calls `runFullSync` with the same `onProgress`/`onWait`, same message strings), with `result = syncResultLine(final)` and `stop = syncStopMessage(final)`.
  - `TopBar(props: { email: string; documents: number | null; sync: { state: "idle" | "loading" | "done" | "error"; run: () => void }; variant: "chat" | "calendar" })`: a square logo mark plus the brand sticker "ENAGRAM*" (link to `/`), status stickers Gmail / Drive (external links, new tab, as today) and Calendar (`next/link` to `/calendar`, with the live dot and the word "CONNECTED"), a Caveat note `{documents} docs indexed` hidden when `documents === null`, a Sync `StickerButton` (label "SYNC" / "SYNCING..." and disabled while loading), the theme toggle (a sun/moon switch), a Disconnect control (plain text style) (calls the existing server action in `src/app/actions.ts`; read how `Sidebar.tsx` does it and keep that exact call), and on `variant="calendar"` a "← CHAT" sticker link to `/`. Below 768px everything except brand and a single "MENU" sticker folds into a menu panel (use a `<details>`-style disclosure with `aria-expanded`).

- [ ] **Step 1: Write the hooks.** `useHealth.ts` and `useSync.ts` as specified (`"use client"`, thin; reuse the helper functions, do not duplicate strings).
- [ ] **Step 2: Build `TopBar.tsx`** per the interface using the Task 3 parts and tokens; min 44px targets; no hard-coded colours.
- [ ] **Step 3: Recompose `Workspace.tsx`:**
  - Remove `Sidebar` and `DbStatusBanner` usage. Layout: a full-height flex column: `TopBar` (variant "chat"), then `<TapeStrip items={selectTapeItems({ dbMessage, chatError: systemError, sync })} onRetry={retryLastMessage} />` in a slot that keeps a fixed minimum height of 0 and animates height (no layout jump while streaming), then `<main>` containing `Chat`.
  - `computeActiveTools` and the tool-name tables stay; pass `activeTools` to `Chat` as a new prop (used by the working ticker in Task 6); keep `respondToApproval`, `retryLastMessage`, `sendStampedMessage`, the auto-sync effect and all `useChat` options exactly as they are.
  - `Chat` loses the `systemError` and `onRetry` props: update its type, delete the `SystemErrorBanner` usage inside `Chat`, and compute `isEmpty = messages.length === 0`. Update every call site.
- [ ] **Step 4: Reduce `SyncButton.tsx` to a thin wrapper** or delete its logic: its behaviour now lives in `useSync`; keep the file only if still imported, otherwise remove the import and leave deletion to Task 8. `ThemeToggle.tsx`: restyle as a sticker toggle (two pressed/unpressed halves with sun/moon icons from lucide-react), same `useTheme` calls, `aria-label` unchanged in meaning, 44px target.
- [ ] **Step 4b: Add preview views** `chat-shell` (top bar + the three tape-strip situations: db problem, chat error with Retry, sync waiting; empty transcript) to `/design` (fixtures only, no network: pass fixture values straight to `TopBar`/`TapeStrip`), run `node scripts/design-shots.mjs chat-shell` against `npm run dev -- -p 3100`, LOOK at the screenshots (including the 390px menu folding), fix what looks wrong, and list the screenshot file paths in the report.
- [ ] **Step 5: Verify:** `npm test` (existing syncClient tests still pass), `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 6: Commit**

```bash
git add src/app
git commit -m "Replace the sidebar with a sticker top bar and a tape strip; move sync and health into hooks"
```

---

### Task 5: Empty state, composer and login

**Files:**
- Modify: `src/app/chat/EmptyState.tsx`, `src/app/chat/Chat.tsx` (layout + composer), `src/app/page.tsx` (login screen only)

**Interfaces:**
- Consumes: `SUGGESTIONS`, `firstName` (`src/lib/ui/greeting.ts`); `StickerButton`, `Chip`, `Card`, `Field`-style input classes (Task 3).
- `EmptyState` keeps its props `{ name?: string; onSend: (text: string) => void; isBusy: boolean }`.

Visual requirements: Empty state = giant `font-display` heading "WHAT'S UP, <FIRSTNAME>?" (clamp the size between 3rem and 8rem; if no name: "WHAT'S UP?"), left-aligned inside a centred max-w-4xl column, with a Caveat note under it ("ask me anything about your mail, files and week"), then the four `SUGGESTIONS` as `Chip`s (tones rotate cobalt / sun / bubblegum / plain; icons from lucide-react: Mail, CalendarDays, HardDrive, Reply), then the composer. Composer (in `Chat.tsx`): one outlined `Card` with a large `<input>` (min-h 56px, `--panel` fill, placeholder "Ask your brain..." / the existing approval placeholder text unchanged) and a `StickerButton tone="cobalt" size="lg"` labelled "GO!" with `aria-label="Send"`; behaviour unchanged (Enter submits, disabled when `inputLocked`, same `handleSubmit`); when the conversation is non-empty the composer is pinned at the bottom of the column. Login (`page.tsx` `LoginScreen`): same sticker language, a giant "ENAGRAM*" display heading, the existing explanatory sentence in DM Sans, and one `StickerButton tone="cobalt" size="lg"` "CONNECT GOOGLE" inside the existing `<form action={...}>` (the server action and `signIn("google")` call are unchanged; if `StickerButton` is a client component, keep the `<form>` in the server file and put the button inside it as it works today for `type="submit"`).

- [ ] **Step 1:** Implement the three files per the requirements above.
- [ ] **Step 1b: Add preview views** `chat-empty` and `login` to `/design` (the login view renders the same markup as `LoginScreen` with a non-submitting button), run `node scripts/design-shots.mjs chat-empty login`, LOOK at the screenshots, fix problems, and list the screenshot paths in the report.
- [ ] **Step 2:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3: Commit**

```bash
git add src/app
git commit -m "Restyle the empty state, the composer and the login screen"
```

---

### Task 6: Messages, sources, approvals and the working ticker

**Files:**
- Create: `src/app/chat/source.ts` (the `Source` type)
- Modify: `src/app/chat/MessageBubble.tsx`, `src/app/chat/ApprovalCard.tsx`, `src/app/chat/Chat.tsx` (transcript area), `src/app/chat/extractSources.ts` (import path for `Source` only), `src/app/chat/extractSources.test.ts` (import path only if it imports `SourceChip`)

**Interfaces:**
- `source.ts` exports `type Source = { tool: "search_gmail" | "search_drive"; title: string; slug: string; score: number; url?: string }` (moved verbatim from `SourceChip.tsx`).
- `MessageBubble` keeps its props (`role, text, sources, approvals, onApprovalResponse, pending, timestamp`) and gains `activeTools?: readonly string[]` (names of running tools, shown by the working ticker while an assistant message is pending and has no text yet).
- `ApprovalCard` keeps `{ card: ApprovalCardModel; onRespond: (approvalId: string, approved: boolean) => void }`; `ApprovalCardModel`, `ApprovalCardStatus` and all wording come from `approvalView.ts` unchanged.

Visual requirements: user message = sun-yellow `Card` right-aligned, label "YOU · hh:mm" in small display type; answer = `panel` `Card` left-aligned with a `Stamp` "BRAIN" and a small speech-bubble tail (a CSS triangle: under the stamp for answers, at the top-right corner for user messages); both max-w ~68ch, plain DM Sans body at 16px/1.55, **no rotation on message cards**; markdown components restyled to tokens (links: `--link` with 2px underline; code: panel with outline; list bullets: small filled squares in `--cobalt`); sources: under the answer a row of `Ticket`s numbered from 1 (Gmail = cobalt, Drive = sun; `n` is the position in the array; `title` is `source.title || source.slug`; keep the `relevance` score in the `title` attribute as today); pending answer with no text = `<WorkingTicker names={activeTools ?? []} />` replacing `ThinkingIndicator`; `ApprovalCard` = a `Card tone="sun"` wrapped in a full hazard-stripe frame (a `.hazard` border all the way round) with a "HOLD UP" heading, the existing sentence, each `details` block in a scrollable `Card` (`max-h-48 overflow-y-auto whitespace-pre-wrap break-words`, `tabIndex={0}`, never truncated), the "Nothing happens until you choose." line, then `StickerButton tone="cobalt"` "APPROVE" and `StickerButton tone="danger"` "DENY" (min 44px), and after the answer the outcome text from `OUTCOME_LABEL` as a `Stamp` plus the same words in plain text (keep the existing strings exactly). Pass `activeTools` from `Chat` to every `MessageBubble`. The transcript container loses its big rounded panel and becomes a plain scroll column.

- [ ] **Step 1:** Create `source.ts`, update imports in `extractSources.ts` (and its test if needed) so nothing imports `SourceChip` for the type.
- [ ] **Step 2:** Restyle `MessageBubble` and `ApprovalCard` per the requirements; wire `activeTools` through `Chat`.
- [ ] **Step 2b: Add preview views** `chat-conversation`, `chat-approval-short`, `chat-approval-long` (a 600-character preference text with newlines), `chat-working` and `chat-error` to `/design` with fixtures, run `node scripts/design-shots.mjs` for them, LOOK at the screenshots, fix problems, and list the screenshot paths in the report.
- [ ] **Step 3:** `npm test` (the existing `approvalView`, `extractSources` tests must still pass), `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 4: Commit**

```bash
git add src/app
git commit -m "Restyle messages, source tickets, the approval card and the working ticker"
```

---

### Task 7: Calendar page

**Files:**
- Modify: `src/app/calendar/page.tsx`, `src/app/calendar/CalendarBoard.tsx`, `src/app/calendar/EventModal.tsx`

**Interfaces:**
- Consumes: `eventColor` (`src/lib/ui/event-color.ts`); `TopBar` (variant "calendar"), `useHealth`, `useSync`, `StickerButton`, `Card`, `Stamp`, `Field`, `Switch` (Tasks 3-4).
- Unchanged and must stay byte-for-byte equivalent in behaviour: all state, `fetchEvents`, the range cache, drag/drop (`handleDrop`, `shiftDateOnly`, `parseEventDate`), month/week math helpers, modal open/close logic, the `EventModal` props (`CalendarEventDTO`, `onSaved`, mode `"create" | "view" | "edit"`) and every `fetch` call and request body.

Visual requirements (spec 5.3): The calendar page renders `TopBar variant="calendar"` (it needs `email`: read it in `page.tsx` from `session.user?.email` and pass it down, a prop addition on `CalendarBoard` only: `email: string`; since `CalendarBoard` is a client component that cannot call `useSync` for the top bar without the hooks, call `useHealth()` and `useSync()` inside it for the bar) above a poster-style heading (`font-display`, clamp 3rem-7rem) with the month name and the year as a `font-hand` note; controls: prev/next `StickerButton`s, "TODAY", a two-sticker MONTH | WEEK toggle (active = cobalt with the pressed shadow), "+ NEW EVENT" `StickerButton tone="sun"`; month grid: a dark weekday header row (`--bg` text on `--ink` fill so it works in both themes) above `grid-cols-7` with `var(--stroke)` lines, outside-month days at 40% opacity, today's number inside a cobalt `Stamp` "TODAY" style, events as thin colour bars (title inside, truncated) whose fill comes from `eventColor(event.id)` mapped to `--cobalt/--on-cobalt`, `--sun/--on-sun`, `--bubblegum/--on-bubblegum`, at most 3 visible plus a "+N MORE" tab (existing logic), time and title in the block; week view: seven tall columns with day-header `Card`s and taller blocks showing time, title, location; an empty visible range shows a `font-hand` note "nothing on... suspicious."; drag: while an event is being dragged it gets `rotate-2` and `--shadow-hard-lg`, the hovered drop day gets a dashed `--sun` outline (use the existing drag state); loading state: a `.hazard` strip across the top of the board; below 768px the month grid shows coloured dots per day and the selected day's events as a list of sticker cards below the grid (selected day = the last clicked day, defaulting to today; this is presentation state only, clicking a day still opens "create"/"view" exactly as today on desktop; on small screens a tap on a day selects it, and a "+ NEW EVENT" button creates). `EventModal`: a `Card` sheet with a folded top-right corner (a CSS corner fold) and a heavy display heading ("NEW EVENT" / the event title / "EDIT EVENT"), `Field`s for title, location, description and the two date-time inputs, `Switch` for all-day, `StickerButton tone="cobalt"` Save, `StickerButton tone="plain"` Cancel, Delete = `StickerButton tone="danger"` that turns into "SURE? DELETE" on the first click and deletes on the second (a presentation-level confirm that sits in front of the existing delete handler; the delete request itself is unchanged), view mode styled as a ticket with the same facts as today; the sheet opens with a small rotation animation (reduced-motion: plain fade), traps focus as it does today, and closes on Escape as it does today.

- [ ] **Step 1:** Restyle `CalendarBoard.tsx` per the requirements (no logic edits besides the small-screen selected-day state and the `email` prop).
- [ ] **Step 2:** Restyle `EventModal.tsx` per the requirements (handlers untouched; add only the two-step delete confirm).
- [ ] **Step 3:** Update `calendar/page.tsx` to pass `email`.
- [ ] **Step 3b: Add preview views** `calendar-month`, `calendar-week`, `event-create`, `event-view`, `event-edit` to `/design` (fixture events for the current month with varied colours and lengths and one all-day event, and a stubbed `fetch` for `/api/calendar/events` installed only inside these views and restored on unmount), run `node scripts/design-shots.mjs` for them, LOOK at the screenshots, fix problems, and list the screenshot paths in the report.
- [ ] **Step 4:** `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 5: Commit**

```bash
git add src/app/calendar
git commit -m "Restyle the calendar board and the event editor"
```

---

### Task 8: Preview completion, polish and cleanup

**Files:**
- Modify: `README.md`, `src/app/globals.css` (remove the legacy bridge and `.thinking-*` rules)
- Delete: `src/app/chat/Sidebar.tsx`, `HeroLogo.tsx`, `ThinkingIndicator.tsx`, `SourceChip.tsx`, `DbStatusBanner.tsx`, `SystemErrorBanner.tsx`, and `src/app/SyncButton.tsx` if nothing imports it

**Interfaces:**
- `/design` route: `page.tsx` is a server component that calls `notFound()` from `next/navigation` when `process.env.NODE_ENV === "production"`, otherwise renders `<DesignPreview />`. It reads search params `theme` (`dark` | `light`, default dark) and `view` and passes them down; `DesignPreview` (client) sets `document.documentElement.dataset.theme` from `theme` in an effect (setState-free: assign the attribute directly) and renders the requested `view`: `chat-empty`, `chat-conversation`, `chat-approval-short`, `chat-approval-long`, `chat-working`, `tape-all`, `chat-error`, `login`, `calendar-month`, `calendar-week`, `event-create`, `event-view`, `event-edit`, `kit` (every shared part side by side). Fixtures in `fixtures.ts` are generic and contain no personal data: two or three short assistant answers with `Source`s, an approval model with a 600-character preference text (newlines included), events for the current month with varied colours/lengths and one all-day event, and a stubbed `fetch` for `/api/calendar/events` installed only inside the calendar views of `DesignPreview` (restore the original `fetch` on unmount).
- `scripts/design-shots.mjs`: Node script (no dependencies) that, given a base URL (default `http://localhost:3100`), runs headless Chrome/Edge from the command line with an isolated `--user-data-dir` in the OS temp directory, for each `view` x `theme` (dark, light) x size (1440x900, 390x844), and saves PNGs to `design-shots/` (git-ignored; add the folder to `.gitignore`). It uses `--headless=new --disable-gpu --hide-scrollbars --virtual-time-budget=6000 --screenshot=... --window-size=WxH <url>`; it must never touch the user's own browser profile and never use the Playwright MCP.

- [ ] **Step 1:** Make sure `/design` has every view listed in its interface (Tasks 3-7 added theirs; add any that are missing, including `tape-all` showing every tape situation at once); verify `notFound` in production by running `npm run build && npx next start -p 3199` and checking `curl -s -o /dev/null -w "%{http_code}" http://localhost:3199/design` prints `404`, then stop that server.
- [ ] **Step 2:** Start `npm run dev -- -p 3100` in the background, run `node scripts/design-shots.mjs` for every view, and look at ALL the screenshots (dark and light, 1440x900 and 390x844) (Read tool renders images). Fix every visible problem found: overflow, unreadable text, broken wrapping, cut-off shadows, missing fonts, layout jump of the tape slot, small-screen layout of the top bar and month grid, contrast issues the automated test cannot see.
- [ ] **Step 3:** Accessibility pass: keyboard-tab through the chat and calendar views (focus ring visible, order sensible), confirm 44px targets, `aria-live` on the tape, the Switch is a real checkbox, buttons have names; fix issues.
- [ ] **Step 4:** Delete the legacy bridge from `globals.css` and the files listed under Delete; `grep` that no import of a deleted file and no legacy variable name (`--bg-panel`, `--accent`, `--text-primary`, `--border`, `--shadow-sm`, `--shadow-md`, `--radius-sm|md|lg`, `--success`, `--danger-soft-bg`, `--selection-text`, `--bg-sidebar`, `--bg-panel-raised`, `--accent-strong`, `--accent-soft-bg`, `--text-secondary`, `--text-tertiary`, `--border-strong`) remains under `src/`. Add a short "Design preview" note to `README.md` (the `/design` route, `node scripts/design-shots.mjs`, development only).
- [ ] **Step 5:** Final verification: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add the development-only design preview and screenshot runner; remove the old sidebar and legacy tokens"
```
