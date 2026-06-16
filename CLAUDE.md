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
- `src/db/db.js` — Dexie schema. Currently version(1): tables `places`, `trips`,
  `scheduleItems`. BudgetEntry deferred. **Next schema change bumps to version(2)**
  and adds `websiteUrl` field to places (non-breaking, existing records get
  undefined which renders as empty).
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
- `src/utils/xlsxImport.js` — pure `parseXlsxWorkbook(workbook)` → `{ places,
  warnings }`. Per-sheet hardcoded strategies + extractGrid heuristic.
- `src/utils/exportHtml.js` — pure `generateDaySheet(trip, scheduleItems,
  placesMap)` → HTML string. No React, no Dexie.
- **`openingHours` semantics (DATA CONTRACT):** for each weekday key —
  **absent key = hours UNKNOWN** (renders `—`); explicit **`null` = CLOSED`**
  (renders `CLOSED`); `{ open, close }` = open. Never write `null` to mean
  "we don't know." Auto-suggest must treat unknown ≠ closed.
- **Model:** a Place is stored **once, globally**; "a city's places" is just a
  filter. A Trip references places and schedules them into `date × block` slots
  via ScheduleItem. Time blocks: `morning / noon / late_afternoon / evening / night`.

## Place schema (current + pending)
Current fields: id, name, type, city, country, lat, lng, address,
googleMapsUrl, untappdUrl, openingHours, tags, notes, status, rating,
createdAt, updatedAt.
**Pending (version 2):** `websiteUrl` — nullable string. Add to db.js
version(2) upgrade block. Add field to PlaceForm and PlaceCard.

## City normalization (KNOWN ISSUE)
The importer produced both "Krakow" and "Kraków" as separate cities.
Canonical spellings to enforce everywhere (importer + any prefill):
  Krakow / Cracow / Cracov → Kraków
  Warsaw / Warsawa → Warszawa (or keep Warsaw — Maxx to decide canonical)
A city merge tool lives in AdminModal: pick source city → target city →
reassign all places. Implement as part of step 7 Commit B.

## isIncomplete definition (CORRECTED)
A place is incomplete if ANY of:
  - type === 'other'
  - openingHours has 0 keys AND type is NOT in
    ['accommodation', 'transport', 'other']
The previous definition included !googleMapsUrl which flagged almost
everything. Maps URL is optional, not a completeness signal.

## Build sequence (status)
1. **DONE** — Scaffold + Dexie schema + dummy-data round-trip.
2. **DONE** — Place library UI: list, search, filter, add/edit/delete,
   hours editor, Open-in-Maps.
3. **DONE** — Maps-link prefill + CSV import.
4. **DONE** — Trips: tab switcher, trip list/form, day × block grid,
   slot assignment, flights, accommodation, ad-hoc items.
5. **DONE** — HTML day-sheet export (offline, tap-to-Maps).
6. **DONE** — XLSX importer: 203 places · 9 cities from Travel_Plans_Yana.xlsx.
7. **IN PROGRESS** — Polish:

   **Commit A — DONE (needs 3 bug fixes before committing):**
   See "Step 7 fixes" below.

   **Commit B — UI polish + schema v2:**
   - Theme toggle (dark/light/system) in statusbar
   - Compact list view + bulk delete for place library
   - Modal CSS extraction to styles.css
   - PlaceForm modal header: fix CACHE → PLACE
   - Slot reorder: up/down arrows in SlotCell
   - Trip list: fix sort (empty startDate → bottom)
   - window.confirm → inline confirmation for all deletes
   - websiteUrl field (schema version(2) bump)
   - City merge tool in AdminModal
   - City normalization in xlsxImport.js
   - Name-based type suggestion on prefill (Museum/Muzeum → museum,
     Hotel/Hostel → accommodation, etc.)
   - Plus code address prefill: extract city/country from suffix
     ("62JF+RM Warsaw, Poland" → city: Warsaw, country: Poland)

## Step 7 fixes (do BEFORE committing Commit A)

### Fix 1 — isIncomplete definition
In App.jsx, replace the current isIncomplete helper with:
  function isIncomplete(p) {
    if (p.type === 'other') return true;
    const hoursTypes = ['taproom','bottle_shop','brewpub','bar',
                        'restaurant','cafe','museum','activity','shop'];
    if (hoursTypes.includes(p.type) &&
        Object.keys(p.openingHours || {}).length === 0) return true;
    return false;
  }
Do NOT flag on missing googleMapsUrl — it's optional, not a
completeness signal. This fix eliminates the false positives.

### Fix 2 — Modal backdrop closes on drag
The modal backdrop onClick fires when mouseup lands outside after a
drag that started inside a field. Fix: in ALL modals that have a
backdrop close handler (PlaceForm, TripForm, CsvImport, XlsxImport,
AdminModal, PlacePicker), track mousedown target and only close if
both mousedown AND mouseup were on the backdrop element itself.
Standard pattern:
  const backdropRef = useRef(null);
  const mouseDownTarget = useRef(null);
  <div ref={backdropRef}
    onMouseDown={e => mouseDownTarget.current = e.target}
    onClick={e => {
      if (e.target === backdropRef.current &&
          mouseDownTarget.current === backdropRef.current) onClose();
    }}>

### Fix 3 — Maps URL paste → auto-parse lat/lng
When user pastes into the Google Maps URL field in PlaceForm, it
should auto-trigger parseMapsUrl and fill lat/lng (and name if empty).
Currently this only fires in the prefill strip, not the URL field
itself. Add an onPaste handler to the googleMapsUrl input that calls
parseMapsUrl and merges lat, lng, and name (if name is currently empty)
into form state. Same pattern as the existing prefill strip.

## Design language — "post-apocalyptic field terminal"
A salvaged-tech / amber-CRT / survival-field-manual feel.
Reference mock: `design-mock.html`.

- **Theming:** CSS custom properties + `[data-theme]` on `<html>`.
  Three themes: `dark` (default), `light`, `system`. Tokens wired since
  step 2. Visible toggle ships in Commit B.
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
