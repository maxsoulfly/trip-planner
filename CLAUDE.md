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
- `src/utils/mapsParser.js` — pure `parseMapsUrl(url)` → `{ name, lat, lng }`.
  Returns `{ short: true }` for goo.gl short URLs. Comment block documents all
  URL shapes handled. Reused by step 6 importer — do not break its interface.
- **`openingHours` semantics (DATA CONTRACT):** for each weekday key —
  **absent key = hours UNKNOWN** (renders `—`); explicit **`null` = CLOSED**
  (renders `CLOSED`); `{ open, close }` = open. Importers, CSV mapping, and any
  prefill MUST preserve this: leave unknown days absent — never write `null` to
  mean "we don't know." Auto-suggest must treat unknown ≠ closed.
- **Model:** a Place is stored **once, globally**; "a city's places" is just a
  filter. A Trip references places and schedules them into `date × block` slots
  via ScheduleItem. Time blocks: `morning / noon / late_afternoon / evening / night`.

## Build sequence (status)
1. **DONE** — Scaffold + Dexie schema + dummy-data round-trip.
2. **DONE** — Place library UI: list, search, filter by city / type / status,
   add / edit / delete with opening-hours editor, Open-in-Maps.
3. **DONE** — Maps-link prefill (auto-parse on paste, name + coords + URL) +
   CSV import (3-step modal: upload → map columns → preview/confirm).
   `papaparse` installed. `openingHours` left absent (unknown) per data contract.
4. **NEXT →** Trips: date × block grid — assign places, flights, accommodation
   (address + map link), ad-hoc items.
5. HTML day-sheet export — offline, tap-to-Maps. The phone deliverable.
6. Importer → seed the library from `Travel_Plans_Yana.xlsx` (best-effort).
7. Polish, then first fast-follow: auto-suggest a plan from saved places,
   constrained by opening hours (heuristic, human-in-the-loop).

## Design language — "post-apocalyptic field terminal"
A salvaged-tech / amber-CRT / survival-field-manual feel. NOT neon cyberpunk and
NOT the near-black + acid-green AI default. Reference mock: `design-mock.html`.

- **Theming:** CSS custom properties + a `[data-theme]` attribute on `<html>`.
  Three themes — `dark` (default), `light`, `system` (follows
  `prefers-color-scheme`). Already wired from step 2. Visible toggle UI is a
  future small step.
  Light mode = _printed field manual_ (manila paper + ink), NOT inverted dark.

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
  `✓ SECURED`). ONE bold flourish; keep everything else quiet.

- **Restraint:** scanline barely-there. Respect `prefers-reduced-motion`.
  Visible keyboard focus. Mobile-responsive (used on the phone mid-trip).

- **Copy:** flavored in-world labels welcome (CACHES, EXPEDITIONS, stamps) BUT
  plain meaning always legible. Never sacrifice clarity for flavor on anything
  actionable.

- **Naming:** no product name baked in until Maxx picks one.

## Commit messages
Format: `<type>(<scope>): <what changed>`
Types: feat · fix · refactor · chore · docs
Scope: db · places · trips · export · importer · ui
One line, present tense, lowercase. No "Step N" as the whole message —
reference it in the body if needed.
Examples:
  feat(places): Maps-link prefill and CSV import with column mapping
  fix(hours): absent key renders — not CLOSED (unknown vs null contract)
  chore(db): bump to version 2, add budgetEntries table

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
