# Trip Planner — Project Context

Local-first, **beer-first (but general)** trip planner for Maxx & Yana,
built around a **Place** as the core object. Full plan and roadmap: **`SPEC.md`**.

## How to work with Maxx

- Direct, practical. Honest uncertainty over confident guessing. Actionable over theory.
- Loop: **discuss → implement → test → commit.** Medium steps, no huge rewrites.
  Show the plan before any big change; wait for "go."
- Maxx reads the code. Hard constraints below are non-negotiable.

## Hard constraints

- **Plain JavaScript — NO TypeScript.** JS + JSX only.
- **Standard CSS** (or CSS Modules). **No Tailwind** unless explicitly asked.
- **React via Vite.** Minimal, well-commented, few dependencies.
- **Local-first, no backend in v1.** All data in the browser.

## Stack

Vite + React (JS) · Dexie (IndexedDB) · Papaparse (CSV) · SheetJS (importer only) ·
state via React Context (no Redux).

## Architecture & conventions

- `src/db/db.js` — Dexie schema = the data model. Tables: `places`, `trips`,
  `scheduleItems`. `BudgetEntry` is deferred to a future `version(2)`.
  **Full record shapes are documented in the comments here** — read them.
- `src/db/repo.js` — the **only** module that touches Dexie. All UI goes through
  repo functions; never call `db` directly from components. A future sync layer
  wraps these.
- `src/db/constants.js` — controlled vocabularies (`PLACE_TYPES`, `BLOCKS`,
  `STATUSES`, `WEEKDAYS`) with emoji. Use these everywhere; don't hardcode.
- `src/utils/hours.js` — `openingHours` helpers.
- **Model:** a Place is stored **once, globally**; "a city's places" is just a
  filter. A Trip references places and schedules them into `date × block` slots
  via ScheduleItem. Time blocks: `morning / noon / late_afternoon / evening / night`.

## Build sequence (status)

1. **DONE (committed)** — Scaffold + Dexie schema + dummy-data round-trip.
   `src/App.jsx` is a throwaway smoke-test screen.
2. **NEXT →** Place library UI: list; search; filter by city / type / status;
   add / edit / delete with a full Place form **including an opening-hours
   editor**; "Open in Google Maps" per place. This replaces the smoke-test App.
3. Add-a-place: paste-Google-Maps-link best-effort prefill + CSV import.
4. Trips: the `date × block` grid — assign places, flights, accommodation
   (address + map link), ad-hoc items.
5. **HTML day-sheet export** — offline, tap-to-Maps. The phone deliverable.
6. Importer → seed the library from `Travel_Plans_Yana.xlsx` (best-effort).
7. Polish, then first fast-follow: auto-suggest a plan from saved places,
   constrained by opening hours (heuristic, human-in-the-loop). The schema
   already supports it.

## Design language — "post-apocalyptic field terminal"

A salvaged-tech / amber-CRT / survival-field-manual feel. NOT neon cyberpunk and
NOT the near-black + acid-green AI default. Reference mock: `design-mock.html`.

- **Theming:** CSS custom properties + a `[data-theme]` attribute on the root.
  Three themes — `dark` (default), `light`, `system` (follows
  `prefers-color-scheme`). Build theme-ready from step 2 (variables, no
  hardcoded colors); the visible toggle UI can ship as a later small step.
  Light mode is reframed as a _printed field manual_ (manila paper + ink), NOT
  an inverted dark mode — identity is carried by type + structure + stamps, not glow.

- **Palette — dark:** `--bg:#0E0E0F` · `--panel:#161518` · `--panel2:#1E1C20` ·
  `--line:#2C2A2E` · `--ink:#E7E1D4` (bone) · `--dim:#948C80` ·
  `--amber:#FFB000` (primary signal — used sparingly) · `--rust:#CC4B2E`
  (warning/closed) · `--steel:#74808C` (info/muted).
- **Palette — light:** `--bg:#E7E0D0` · `--panel:#F1EBDC` · `--panel2:#E2DAC6` ·
  `--line:#C5B99E` · `--ink:#211D15` · `--dim:#6B6354` · `--amber:#9C5A12`
  (burnt-amber ink) · `--rust:#9A2E15` · `--steel:#5A6066`.

- **Type:** display = **Space Grotesk** (700); body = **IBM Plex Sans**;
  data/utility = **IBM Plex Mono** — use mono for ALL data (hours, coordinates,
  flight codes, statuses, eyebrows). This is meaningful, not decorative.

- **Signature element:** the status **stamp** — wishlist / planned / visited shown
  as an inked, slightly-rotated rubber stamp (`☆ FLAGGED` / `◐ MARKED` /
  `✓ SECURED`). It is the ONE bold flourish; keep everything else quiet.
  Place cards read like salvaged dossiers: type glyph + name (display), a mono
  coordinate line, a mono hours readout with a 7-day open/closed strip, and
  "Open in Google Maps" as a terminal-style action.

- **Restraint:** scanline/CRT texture is _barely_ there (overdone CRT is a
  cliché). Respect `prefers-reduced-motion`. Visible keyboard focus. Responsive
  to mobile (it's used on the phone mid-trip). Spend boldness only on the stamp.

- **Copy:** flavored, in-world labels are welcome (CACHES, EXPEDITIONS, the
  stamps) BUT plain meaning must always stay legible. Never sacrifice clarity
  for flavor on anything actionable.

- **Naming:** "WAYPOINT" in the mock is placeholder text, NOT a chosen name.
  Don't bake any product name in until Maxx picks one.

## Don't

No TypeScript. No Tailwind unless asked. No backend in v1. Don't bypass
`repo.js`. Don't wholesale-rewrite working code — medium steps only.

## Worklog protocol

At the end of every work step, append an entry to `WORKLOG.md` (create it if
missing). Keep it short and factual — it's a handoff for the planning Claude in
the chat, who cannot see this repo. Each entry:

### <date> — Step N: <short title>

- **Done:** what was actually built/changed (files touched, key decisions).
- **Deviations:** anything that differs from SPEC.md / CLAUDE.md, and why.
- **Schema/contract changes:** any change to db.js, repo.js, or constants.js.
- **Known issues / TODO:** bugs, shortcuts, things left for later.
- **Next:** what step or task comes next.
  Do not rewrite earlier entries — only append.
