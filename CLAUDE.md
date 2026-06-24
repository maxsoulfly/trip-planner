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
- `src/db/db.js` — Dexie schema. Currently **version(2)**: tables `places`,
  `trips`, `scheduleItems`. BudgetEntry deferred.
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
  `deriveFields(segments)` → `{ city, country, address }`. City = **last** city
  chip (not join-all) — handles district-before-city patterns. Lone-digit
  segments → `ignore` (fixes building-number-prefix bug). Used by PlaceForm
  address chips and blob notepad. Both exports are pure, no Dexie.
- `src/utils/blobParser.js` — pure `parseBlob(text)` → `{ lines, extracted }`.
  Line classifier (first-match): `url-maps`, `url-untappd`, `url-website`,
  `url-facebook`, `url-instagram`, `hours` (Format A + B), `address`, `name`.
  Blank lines filtered before classification. Extraction runs existing parsers
  (`parseMapsUrl`, `parseGoogleHours`, `parseAddress`) and collects
  `{ name, url, lat, lng, nameFromUrl, openingHours, addrSegments, addrDerived,
  untappdUrl, websiteUrl, facebookUrl }`.
- `src/utils/xlsxImport.js` — pure `parseXlsxWorkbook(workbook)` → `{ places,
  warnings }`. Per-sheet hardcoded strategies + extractGrid heuristic.
- `src/utils/exportHtml.js` — pure `generateDaySheet(trip, scheduleItems,
  placesMap)` → HTML string. No React, no Dexie.
- `src/utils/exportTripXlsx.js` — pure `exportTripXlsx(trip, scheduleItems,
  placesMap)` → triggers browser download as `[title]-schedule.xlsx`.
- `src/utils/importTripXlsx.js` — pure `parseTripXlsx(workbook, trip, allPlaces)`
  → `{ toSchedule, stubPlaces, warnings }`.
- **`openingHours` semantics (DATA CONTRACT):** for each weekday key —
  **absent key = hours UNKNOWN** (renders `—`); explicit **`null` = CLOSED**
  (renders `CLOSED`); `{ open, close }` = open. Never write `null` to mean
  "we don't know." Auto-suggest must treat unknown ≠ closed.
- **Model:** a Place is stored **once, globally**; "a city's places" is just a
  filter. A Trip references places and schedules them into `date × block` slots
  via ScheduleItem. Time blocks: `morning / noon / late_afternoon / evening / night`.

## Place schema (current)
Fields: id, name, type, city, country, lat, lng, address, googleMapsUrl,
untappdUrl, websiteUrl, openingHours, tags, notes, status, rating,
createdAt, updatedAt.

## PLACE_TYPES (current — constants.js)
taproom · bottle_shop · brewpub · brewery · bar · restaurant · cafe ·
museum · park · activity · shop · supermarket · accommodation · transport · other
Plus status: wishlist · planned · visited · permanently_closed

## detectType keywords (PlaceForm.jsx — ordered, first match wins)
bottle_shop → beer shop / bottle shop / beer store
brewery → brewery / browar / brauerei / pivovar
brewpub → brewpub / brew pub / beer & food / beer and food / brewing
taproom → taproom / tap room / beer bar / craft beer / beer
restaurant → restaurant / bistro / brasserie / ristorante
cafe → café / cafe / coffee / kawiarnia / kaffee
bar → bar
museum → museum / muzeum / muzej / gallery / galeria / galeri
park → park / cemetery / cmentarz / hřbitov / garden / jardín / zoo / botanical
accommodation → hotel / hostel / noclegi / apartment / apartament / pension / inn

## Pending features (agreed, not yet built)
- **Venue traits** — controlled vocabulary secondary tags:
  `craft-beer · taps-on-site · bottles-to-go · food · wine · cocktails · coffee · outdoor`
  Stored in `tags` array alongside free tags, surfaced as chips in PlaceForm.
  Filters match on `type` OR trait. (Next brief.)
- **Flight email parser** — paste a Wizzair (+ common airline) booking email,
  extract both flight legs into `outboundFlight` / `inboundFlight` + offer to
  set trip start/end dates. (Standalone pure function, no dependencies.)
- **Accommodation check-in/out fields** — two time fields shown only when
  `type === 'accommodation'`. Additive, no schema bump.
- **Bulk place paste** — paste N place names (e.g. from Telegram), each line
  becomes a stub place (`wishlist`, `other`); dedup UI matches against library.
- **State/region field + grouped city filter** — optional `state` field on Place
  (for `Portland, OR` vs `Portland, ME`). Dexie version(3) bump. Filter groups
  by country then city. Address parser routes state abbreviation to `state`.
- **Block time-ranges** — clock range per block (morning 06–11, noon 11–15,
  late_afternoon 15–18, evening 18–23, night 23–06). Foundation for
  flight-by-time and hours-aware auto-suggest.
- **Flight-by-time grid placement** — correct block by departure/arrival clock
  time; grey out slots before arrival / after departure. Requires block time-ranges.
- **Nearby auto-suggest** — given a filled slot, suggest nearby places by
  haversine on lat/lng, open in that block. Requires block time-ranges.
  Silently skips places with no coords. One-slot-at-a-time, human-in-the-loop.

## Known issues (parked)
- Overnight hours (e.g. 22:00–02:00) not handled by `getStatusBadge` in
  PlaceCard — shows as not open at e.g. 01:00. Low priority.
- Plus-code addresses (`62JF+RM Warsaw, Poland`) not handled by blob parser —
  the trailing comma-separated parts parse fine; the plus-code prefix goes to
  street/ignore. Acceptable for now.
- City filter will need grouping when library grows past ~20 cities. The
  state/region field (pending) is the clean fix.

## City normalization (KNOWN ISSUE)
Importer produced "Krakow" and "Kraków" as separate cities. Canonical:
  Krakow / Cracow / Cracov → Kraków
  Warsaw / Warsawa → Warszawa (or keep Warsaw — Maxx to decide)
City merge tool lives in AdminModal.

## isIncomplete definition
A place is incomplete if ANY of:
  - type === 'other'
  - openingHours has 0 keys AND type NOT IN
    ['accommodation', 'transport', 'other']
Maps URL is optional, not a completeness signal.
`permanently_closed` status → never flagged incomplete.

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
   name-based type detection, Maps URL paste auto-parse, isIncomplete fix,
   modal backdrop drag fix.
8. **DONE** — Trip XLSX export/import (replace-on-import), click-to-edit place
   in grid, drop Trip-level accommodation field.
9. **DONE** — Address paste with tap-to-label segments. New utils: `countries.js`
   (complete ISO-3166 list + `findCountry`), `addressParser.js` (`parseAddress`,
   `deriveFields`). PlaceForm address prefill replaced with chip UI; live-apply
   via `useEffect` on `addrSegments`.
10. **DONE** — Blob notepad smart-paste. New `blobParser.js` + `BlobPreview.jsx`.
    QUICK PASTE section at top of PlaceForm; routes URL/hours/address/name to
    existing parsers; APPLY writes all non-null extracted values to form state.
    Social links (Facebook/Instagram) shown in preview, not written to any field.
11. **DONE** — Bug fixes: midnight-close badge (00:00 → 1440 min), alternating
    hours blob format, multi-type URL routing (untappd/website/social), Maps URL
    paste hint in edit mode.
12. **DONE** — Blob display fixes (URL truncation, blank-line chips), city parse
    fixes (lone-digit ignore, last-city-chip), card name → Maps link,
    brewery + park types added to constants.

## Design language — "post-apocalyptic field terminal"
A salvaged-tech / amber-CRT / survival-field-manual feel.

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
