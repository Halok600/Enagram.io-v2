# Enagram.io frontend redesign: "STICKER"

Date: 2026-10-09. Status: design approved section by section by the owner; written spec awaiting owner review.

## 1. Goal and non-goals

**Goal.** Replace the whole look and layout of the chat screen, the login screen and the calendar page with a bold, distinctive, poster / neo-brutalist design ("STICKER"), so the app no longer looks like a generic dark-mode indigo AI tool.

**Non-goals (binding).**
- No behaviour changes: API routes, sync, search, auth, the approval flow, error handling, database code and all existing tests stay as they are. This is presentation, layout and the front-end structure that serves them.
- No new features. (The top bar shows facts the app already has: connection status, document count from `/api/health`, sync state.)
- The Portfolio project (D:\Projects\Portfolio) is not touched.

## 2. Owner constraints

- Take inspiration from the best chatbot / product interfaces, not from the owner's portfolio. The portfolio is a taste reference only: do NOT copy its layout, its lime or orange-red palette, its film grain, its corner-bracket "detection box", its mono-caps-everywhere labels or its row-index structure.
- "Crazy, tacky, cool", but not AI slop: no purple/indigo gradients, no glass cards, no default component-library look.
- Both a dark and a light theme, designed together; the theme toggle stays.
- The owner must be the sole contributor on every commit (no Co-Authored-By trailer, no "Generated with" line).

## 3. Research that informed this

Screenshots of real sites were taken with an isolated headless browser on 2026-10-09 (Claude and Perplexity blocked automated access, so only their well-known patterns were used, not screenshots).
- Grok, v0, T3.chat: the prompt box is the hero of the empty state; a model chip lives inside it; quick-action chips sit under it; chrome is minimal; the thread list is a thin rail with search.
- Linear, Raycast: one memorable visual idea and everything else restrained.
- Nothing, Teenage Engineering: the "crazy cool" end. TE is the main reference for STICKER: poster-size heavy type, hand-drawn art, one loud accent on a plain ground.
- Notion Calendar, Fantastical: colour-coded event blocks, friendly large headline.
- Anti-patterns to avoid: purple-indigo gradient with glass cards, Inter-on-dark with one pastel accent, generic rounded-card dashboards, decorative emoji bullets.

## 4. Visual system

### 4.1 Rules
1. Every surface has a 2.5px solid outline (`--line`) and a hard offset shadow with no blur (`--shadow-hard`, 4px 4px 0 in light mode). In dark mode the shadow uses an accent colour so depth stays visible against the dark ground.
2. Pressable elements are physical: hover raises to a 6px shadow; press translates into the shadow (shadow 1px). Decorative stickers (chips, tags, status stickers, ticket stubs) tilt up to 1 degree on hover. Text blocks that must be read at length (answers, form fields) never rotate.
3. Flat colour only: no gradients, no blur, no glass, no film grain.
4. Radius: 4px for cards and fields, full pill for chips and tags. No in-between "soft card" radius.
5. Focus ring: 3px solid sun yellow with 2px offset on every focusable element (both themes).
6. Motion uses framer-motion (already a dependency): spring "thunk" on press, sticker pop-in with a small rotation, marker-highlight on cited sources; everything is disabled or reduced under `prefers-reduced-motion`.

### 4.2 Tokens (final values are set by the contrast test, 4.4; these are the starting values)
| Token | Light | Dark |
|---|---|---|
| `--bg` | cream `#fbf4e4` | ink `#121212` |
| `--panel` | `#fffaf0` | `#1b1b1b` |
| `--ink` (text, outlines) | `#111111` | cream `#f5f0e6` |
| `--cobalt` (primary) | `#2a3bff` | `#5566ff` |
| `--sun` (attention, focus) | `#ffd23f` | `#ffd23f` |
| `--bubblegum` (secondary, calendar) | `#ff7ab8` | `#ff7ab8` |
| `--danger` (fill) / `--danger-ink` (text) | `#ff4d3d` / `#c4220f` | `#ff6a5c` / `#ff8f84` |
| `--shadow-hard` colour | ink | cobalt-lifted |

### 4.3 Type
- Display: Archivo, variable, width axis at its widest and weight 900, uppercase, tight leading (`next/font/google`, axes `wdth`). Used for the brand, the empty-state headline, the calendar month heading, section headings.
- Body and UI: DM Sans 16px / 1.55. Answer text stays plain DM Sans.
- Annotation: Caveat, only for short handwritten margin notes (e.g. "163 docs indexed", "nothing on... suspicious").
- If the Archivo width axis does not load through `next/font`, fall back to Archivo Black for headings; record the ruling in the plan.

### 4.4 Accessibility
- A unit test computes the WCAG contrast ratio of every foreground/background token pair that is used for text or essential graphics, in both themes, and fails below AA (4.5:1 for body text, 3:1 for large text and UI outlines). The token values above are adjusted until it passes.
- 44px minimum touch targets, visible focus ring, semantic landmarks, `aria-live` for the tape strip, reduced-motion respected, no information conveyed by colour alone (status stickers also carry text).

## 5. Screens

### 5.1 Chat screen (replaces Sidebar, HeroLogo, EmptyState, ThinkingIndicator styling and the chat shell)
- **Top bar** (full width, shared with the calendar page): brand sticker; Gmail / Drive / Calendar status stickers with a live dot and text (Calendar is the link to /calendar; Gmail and Drive open Google in a new tab, as today); a handwritten indexed-document count (from `/api/health`, hidden if unavailable); Sync button; theme toggle; Disconnect. On small screens it collapses to a single menu sticker.
- **Tape strip** (hazard-tape: diagonal yellow and ink stripes): rendered only when there is something to say, in priority order: database problem (existing DbStatusBanner content), chat error (existing SystemErrorBanner content with Retry), sync progress / "Waiting 40s so Gemini's free-tier limit can recover (N document(s) left)..." / quota-stop and stall messages (existing SyncButton text), sync result line. Uses `aria-live="polite"`.
- **Empty state:** giant heading "WHAT'S UP, <FIRST NAME>?" and four suggestion stickers, replacing the current hard-coded placeholder-named prompts with generic useful ones (e.g. "Summarise my recent emails", "What's on my calendar this week?", "Find my latest Drive files", "What needs a reply?"). The composer is large and centred under them.
- **Conversation:** centred column, max width about 820px. User messages: sun-yellow cards, right-aligned. Answers: cream cards with the thick outline and a small "BRAIN" tag, left-aligned, plain readable text, markdown rendering unchanged.
- **Sources:** ticket stubs (perforated edge via CSS, a number, a colour by source type: Gmail cobalt, Drive sun, Calendar bubblegum) under the answer; same data and links as the current source chips.
- **Working state:** a caution-tape ticker naming the running tool ("SEARCHING GMAIL...") in place of the dots. Tool names map to short labels; unknown tools show a generic label.
- **Approval card:** a "HOLD UP" card with hazard stripes, the sentence describing the action, the full payload text in a scrollable block (preserving line breaks, never truncated), a cobalt Approve and a tomato Deny, then the outcome stamped. Same props and behaviour as the current ApprovalCard.
- **Composer:** large outlined field with a "GO!" button; disabled while an approval is pending (existing behaviour); Enter sends, Shift+Enter newline (existing behaviour kept).

### 5.2 Login screen
Same sticker language, one giant "CONNECT GOOGLE" button and the existing explanatory sentence. The server action and `signIn("google")` call are unchanged.

### 5.3 Calendar page (replaces the look of CalendarBoard and EventModal; logic unchanged)
- Shared top bar plus a "← CHAT" sticker.
- Heading: the month name in giant display type (e.g. OCTOBER) with the year as a handwritten note.
- Controls: previous, next, TODAY; MONTH | WEEK as two stickers (active = cobalt, appears pressed); "+ NEW EVENT" in sun yellow.
- **Month view:** thick-lined grid; days outside the month fade; today carries a cobalt "TODAY" sticker; events are sticker blocks coloured cobalt, sun or bubblegum from a stable hash of the event id (text colour chosen for contrast); at most 3 visible per day plus a "+N MORE" tab (existing behaviour); empty month shows a handwritten note.
- **Week view:** seven tall columns with day-header cards; events are taller stickers with time, title and location.
- **Drag to reschedule:** the dragged event lifts and tilts about 2 degrees; the target day shows a dashed sun outline; drop logic and API calls unchanged.
- **Event editor:** a "paper form" sheet that pops in slightly rotated; heavy heading; thick-outlined inputs with a yellow focus shadow; all-day as a chunky switch; Save cobalt; Delete tomato requiring a second click to confirm; read-only view styled as a ticket. Fields, validation and calls unchanged.
- **Small screens:** month grid shows coloured dots; the selected day's events list below as sticker cards.

## 6. Architecture

- All tokens are CSS variables in `src/app/globals.css` with `:root` (light) and `:root[data-theme="dark"]` (dark), mapped into Tailwind through `@theme inline`. Components reference tokens only, never raw hex.
- New shared presentational components in `src/app/ui/`: `StickerButton`, `Chip`, `Card`, `TapeStrip`, `TopBar`, `Ticket`, `Field`, `Switch`, `Stamp`. Each is small, single-purpose, typed props, no data fetching.
- Presentation logic as pure, unit-tested functions: event colour from id, tape-strip message selection and priority, tool-name to label, source-type to colour, contrast calculation, first-name extraction.
- The existing hooks and data flow (`useChat`, `runFullSync`, `/api/health`, `/api/calendar/*`, `signIn`) are passed through unchanged; components are re-skinned and re-composed. Where a component must receive data it did not before (e.g. the document count), it fetches `/api/health` itself through a small client hook.
- Removed after replacement: `Sidebar.tsx`, `HeroLogo.tsx`, the old banners and indicators once their content lives in the tape strip, with all imports updated.

## 7. Testing and verification

- All existing tests (231 at the time of writing) keep passing. New tests cover every pure function above and the contrast rule.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` must pass.
- **Design-preview route** `/design` (development only: returns not-found when `NODE_ENV === "production"`) renders every state with fixture data: empty chat, conversation with sources, pending approval (short and long text), every tape-strip variant, errors, login, calendar month and week with sample events, event editor in each mode. It contains no authentication or API dependency (fetches for calendar events are stubbed inside the route only).
- Screenshots of `/design` are taken with an isolated headless browser at 1440x900 and 390x844, light and dark, and shown to the owner. The owner approves the look from the screenshots before anything reaches `main`.
- A whole-branch review on the most capable model before merge.

## 8. Delivery

- Work happens on branch `redesign`; `main` (the live deployment) is untouched until the owner approves.
- Five phases, each an implementer plus a reviewer: (1) foundations: tokens, fonts, shared parts, themes, contrast test; (2) chat shell: top bar, tape strip, empty state, composer, login; (3) messages: cards, tickets, approval, errors, working ticker; (4) calendar: board, drag, editor; (5) polish: responsive, accessibility, `/design` route completion, final review.
- After owner approval: fast-forward `main`, push (Vercel deploys), then verify the live site: sign in, ask a question, open the calendar, press Sync, theme toggle.
- Rollback: Vercel "Instant Rollback" to the previous deployment, or revert the merge.

## 9. Risks

- Loud styling hurting readability: mitigated by plain body text, no rotation on reading surfaces, and the contrast test.
- Archivo width axis unavailable through `next/font`: fallback in 4.3.
- Phone layouts for the top bar and the month grid: covered by the 390px screenshots.
- Visual taste cannot be unit-tested: mitigated by owner review of screenshots before merge.
- Streaming answers must not jump the layout: reserve the tape-strip space with a fixed-height slot or animate height; verified in review.
