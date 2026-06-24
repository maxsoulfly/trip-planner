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
- `src/db/db.js` — Dexie schema. Currently version(2): tables `places`, `trips`,
  `scheduleItems`. BudgetEntry deferred.
- `src/db/repo.js` — the **only** module that touches Dexie. All UI goes through
  repo functions; never call `db` directly from components.
- `src/db/constants.js` — controlled vocabularies (`PLACE_TYPES`, `BLOCKS`,
  `STATUSES`, `WEEKDAYS`). Use these everywhere; don't hardcode.
- `src/utils/hours.js` — `openingHours` helpers.
- `src/utils/hoursParser.js` — `parseGoogleHours(text)` → partial openingHours.
  Handles Google Maps copy-paste format (alternating day/hours lines) and
  compact format (day: hours per line). Contract preserved: absent=unknown.
- `src/utils/mapsParser.js` — pure `parseMapsUrl(url)` → `{ name, lat, lng }`.
  Returns `{ short: true }` for goo.gl short URLs.
- `src/utils/countries.js` — `COUNTRIES` array (~195 ISO-3166 entries, each
  `{ iso2, names[] }`). `findCountry(text)` → `{ iso2, matchedText }` or `null`.
  Longest-name-first matching, word-boundary regex. Curated abbreviations only:
  `USA`, `US`, `UK`, `UAE`. **No arbitrary 2-letter codes** (avoids PL-bug class).
- `src/utils/addressParser.js` — pure `parseAddress(text)` → `{ segments, derived }`.
  `deriveFields(segments)` → `{ city, country, address }`. Used by PlaceForm
  address chips and (next) the blob notepad smart-paste. Both are pure, no Dexie.
- `src/utils/xlsxImport.js` — pure `parseXlsxWorkbook(workbook)` → `{ places,
  warnings }`. Per-sheet hardcoded strategies + extractGrid heuristic.
- `src/utils/exportHtml.js` — pure `generateDaySheet(trip, scheduleItems,
  placesMap)` → HTML string. No React, no Dexie.
- `src/utils/exportTripXlsx.js` — pure `exportTripXlsx(trip, scheduleItems,
  placesMap)` → triggers browser download as `[title]-schedule.xlsx`.
- `src/utils/importTripXlsx.js` — pure `parseTripXlsx(workbook, trip, allPlaces)`
  → `{ toSchedule, stubPlaces, warnings }`.
- **`openingHours` semantics (DATA CONTRACT):** for each weekday key —
  **absent key = hours UNKNOWN** (renders `—`); explicit **`null` = CLOSED`**
  (renders `CLOSED`); `{ open, close }` = open. Never write `null` to mean
  "we don't know." Auto-suggest must treat unknown ≠ closed.
- **Model:** a Place is stored **once, globally**; "a city's places" is just a
  filter. A Trip references places and schedules them into `date × block` slots
  via ScheduleItem. Time blocks: `morning / noon / late_afternoon / evening / night`.

## Place schema (current)
Fields: id, name, type, city, country, lat, lng, address, googleMapsUrl,
untappdUrl, websiteUrl, openingHours, tags, notes, status, rating,
createdAt, updatedAt.

## Pending features (agreed, not yet built)
- **Venue traits** — controlled vocabulary secondary tags for "also has":
  `craft-beer · taps-on-site · bottles-to-go · food · wine · cocktails · coffee · outdoor`
  Stored in `tags` array alongside free tags, surfaced as chips in PlaceForm.
  Filters match on `type` OR trait. (Brief not yet written.)
- **Blob notepad smart-paste** — one-block paste dispatcher: classifies each
  line/segment as URL / hours / address / name and fans out to existing parsers
  (`parseMapsUrl`, `parseGoogleHours`, `parseAddress`). Reuses `countries.js`,
  `addressParser.js`, and `.addr-chip` CSS from Step 9. (Brief in progress.)
- **Flight email parser** — paste a Wizzair (and common airline) booking email,
  extract both flight legs into `outboundFlight` / `inboundFlight` + offer to
  set trip start/end dates.
- **Accommodation check-in/out fields** — two time fields shown only when
  `type === 'accommodation'`. Additive, no schema bump needed.
- **Bulk place paste** — paste N place names (e.g. from Telegram), each line
  becomes a stub place (`wishlist`, `other`); dedup UI matches against library
  and lets user choose merge-into-existing vs create-new per line.
- **Block time-ranges** — assign a clock range to each block
  (`morning 06–11`, `noon 11–15`, `late_afternoon 15–18`,
  `evening 18–23`, `night 23–06`). Foundation for flight-by-time placement
  and hours-aware auto-suggest.
- **Flight-by-time grid placement** — place flights into the correct block by
  departure/arrival time (not always morning). Grey out slots before arrival /
  after departure. Requires block time-ranges above.
- **Nearby auto-suggest** — given a filled slot, suggest nearby places (by
  haversine on lat/lng) that are open in that block. Requires block time-ranges.
  Silently skips places with no coords. Intentionally one-slot-at-a-time,
  human-in-the-loop.

## City normalization (KNOWN ISSUE)
The importer produced both "Krakow" and "Kraków" as separate cities.
Canonical spellings to enforce everywhere (importer + any prefill):
  Krakow / Cracow / Cracov → Kraków
  Warsaw / Warsawa → Warszawa (or keep Warsaw — Maxx to decide canonical)
A city merge tool lives in AdminModal: pick source city → target city →
reassign all places.

## isIncomplete definition (CORRECTED)
A place is incomplete if ANY of:
  - type === 'other'
  - openingHours has 0 keys AND type is NOT in
    ['accommodation', 'transport', 'other']
Maps URL is optional, not a completeness signal.

## Build sequence (status)
1. **DONE** — Scaffold + Dexie schema + dummy-data round-trip.
2. **DONE** — Place library UI: list, search, filter, add/edit/delete,
   hours editor, Open-in-Maps.
3. **DONE** — Maps-link prefill + CSV import.
4. **DONE** — Trips: tab switcher, trip list/form, day × block grid,
   slot assignment, flights, accommodation, ad-hoc items.
5. **DONE** — HTML day-sheet export (offline, tap-to-Maps).
6. **DONE** — XLSX importer: 203 places · 9 cities from Travel_Plans_Yana.xlsx.
7. **DONE** — Polish: theme toggle, compact list view, bulk delete, slot reorder,
   inline confirms, websiteUrl (schema v2), city merge tool, city normalization,
   name-based type detection, plus code prefill, Maps URL paste auto-parse,
   isIncomplete fix, modal backdrop drag fix.
8. **DONE** — Trip XLSX export/import (replace-on-import), click-to-edit place
   in grid, drop Trip-level accommodation field.
9. **DONE** — Address paste with tap-to-label segments. New utils: `countries.js`
   (complete ISO-3166 list + `findCountry`), `addressParser.js` (`parseAddress`,
   `deriveFields`). PlaceForm address prefill section replaced with chip UI;
   live-apply via `useEffect` on `addrSegments`.

## Design language — "post-apocalyptic field terminal"
A salvaged-tech / amber-CRT / survival-field-manual feel.
Reference mock: `design-mock.html`.

- **Theming:** CSS custom properties + `[data-theme]` on `<html>`.
  Three themes: `dark` (default), `light`, `system`. Visible toggle in statusbar.
  Light mode = printed field manual (manila paper + ink), not inverted dark.

- **Palette — dark:** `--bg:#0E0E0F` · `--panel:#161518` · `--panel2:#1E1C20` ·
  `--line:#2C2A2E` · `--ink:#E7E1D4` · `--dim:#948C80` · `--amber:#FFB000` ·
  `--rust:#CC4B2E` · `--steel:#74808C`.
- **Palette — light:** `--bg:#E7E0D0` · `--panel:#F1EBDC` · `--panel2:#E2DAC6` ·
  `--line:#C5B99E` · `--ink:#211D15` · `--dim:#6B6354` · `--amber:#9C5A12` ·
  `--rust:#9A2E15` · `--steel:#5A6066`.

- **Type:** Space Grotesk (700) display · IBM Plex Sans body ·
  IBM Plex Mono for ALL data (hours, coords, codes, statuses, eyebrows).

- **Stamp:** `☆ FLAGGED` / `◐ MARKED` / `✓ SECURED` — the ONE bold flourish.

- **Restraint:** scanline barely-there. prefers-reduced-motion respected.
  Mobile-responsive. Boldness spent only on the stamp.

- **Copy:** flavored labels welcome but plain meaning always legible.
  Never sacrifice clarity for flavor on actionable elements.

- **Naming:** no product name baked in until Maxx picks one.

## Commit messages
Format: `<type>(<scope>): <what changed>`
Types: feat · fix · refactor · chore · docs
Scope: db · places · trips · export · importer · ui · admin
Examples:
  fix(ui): isIncomplete definition, modal backdrop drag, maps url parse
  feat(ui): theme toggle, compact view, bulk delete, slot reorder
  feat(admin): city merge tool
  chore(db): version 2, add websiteUrl to places

## Don't
No TypeScript. No Tailwind unless asked. No backend in v1. Don't bypass
`repo.js`. Don't wholesale-rewrite working code — medium steps only.

## Worklog protocol
At the end of every work step, append an entry to `WORKLOG.md` (create
it if missing). Read the files you changed — write from reality, not
from memory or a template. Each entry:

### <date> — Step N: <short title>

- **Done:** files touched + what actually changed in each.
- **Deviations:** anything differing from SPEC.md / CLAUDE.md, and why.
- **Schema/contract changes:** any change to db.js, repo.js, constants.js.
- **Known issues / TODO:** bugs, shortcuts, deferred items.
- **Next:** what comes next.
Do not rewrite earlier entries — only append.
