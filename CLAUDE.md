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
- `src/db/db.js` — Dexie schema. Currently **version(4)**: tables `places`,
  `trips`, `scheduleItems`. BudgetEntry deferred.
- `src/db/repo.js` — the **only** module that touches Dexie. All UI goes through
  repo functions; never call `db` directly from components.
- `src/db/constants.js` — controlled vocabularies (`PLACE_TYPES`, `BLOCKS`,
  `STATUSES`, `WEEKDAYS`, `VENUE_TRAITS`). Use these everywhere; don't hardcode.
  `BLOCKS` entries have `start`/`end` hour fields (24h) for time-range logic.
  `night` block has `start: null, end: null` — timeless, never returned by
  `blockForTime`. Block order: early_morning(0) morning(1) noon(2)
  late_afternoon(3) evening(4) night(5).
- `src/utils/hours.js` — `openingHours` helpers.
- `src/utils/hoursParser.js` — `parseGoogleHours(text)` → `{ openingHours, meta }`.
  `openingHours` is a partial weekday map. `meta` may contain `{ checkIn, checkOut }`
  (HH:MM strings) when check-in/out lines are present. Handles Google Maps
  copy-paste format (alternating day/hours lines) and compact format
  (day: hours per line). Contract preserved: absent=unknown.
- `src/utils/mapsParser.js` — pure `parseMapsUrl(url)` → `{ name, lat, lng }`.
  Returns `{ short: true }` for goo.gl short URLs.
- `src/utils/countries.js` — `COUNTRIES` array (~195 ISO-3166 entries, each
  `{ iso2, names[] }`). `findCountry(text)` → `{ iso2, matchedText }` or `null`.
  Longest-name-first matching, word-boundary regex. Curated abbreviations only:
  `USA`, `US`, `UK`, `UAE`. **No arbitrary 2-letter codes** (avoids PL-bug class).
- `src/utils/addressParser.js` — pure `parseAddress(text)` → `{ segments, derived }`.
  `deriveFields(segments)` → `{ city, state, country, address }`. City = **last** city
  chip (not join-all) — handles district-before-city patterns. Lone-digit
  segments → `ignore` (fixes building-number-prefix bug). Used by PlaceForm
  address chips and blob notepad. Both exports are pure, no Dexie.
- `src/utils/blobParser.js` — pure `parseBlob(text)` → `{ lines, extracted }`.
  Line classifier (first-match): `url-maps`, `url-untappd`, `url-website`,
  `url-facebook`, `url-instagram`, `checkin`, `checkout`, `ignore-label`,
  `hours` (Format A + B), `address`, `name`.
  Blank lines and `ignore-label` lines (Lunch/Happy hours/Kitchen/etc.) filtered
  before classification. Extraction runs existing parsers and collects
  `{ name, url, lat, lng, nameFromUrl, openingHours, checkIn, checkOut,
  addrSegments, addrDerived, untappdUrl, websiteUrl, facebookUrl }`.
- `src/utils/xlsxImport.js` — pure `parseXlsxWorkbook(workbook)` → `{ places,
  warnings }`. Per-sheet hardcoded strategies + extractGrid heuristic.
- `src/utils/haversine.js` — pure `haversine(lat1,lng1,lat2,lng2)` → km.
  No imports. Used by TripGrid nearby auto-suggest.
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
Fields: id, name, type, city, state, country, lat, lng, address, googleMapsUrl,
untappdUrl, websiteUrl, checkIn, checkOut, openingHours, tags, notes, status, rating,
createdAt, updatedAt.
checkIn / checkOut: HH:MM strings, only shown/editable when type === accommodation.

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

## Known issues (parked)
- Plus-code addresses (`62JF+RM Warsaw, Poland`) not handled by blob parser —
  the trailing comma-separated parts parse fine; the plus-code prefix goes to
  street/ignore. Acceptable for now.

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
9. **DONE** — Overnight hours fix in `getStatusBadge` (`closeMins <= openMins` overnight detection; `nowMins >= openMins || nowMins < closeMins` for open check). One-liner in `PlaceCard.jsx`.
10. **DONE** — Address paste with tap-to-label segments. New utils: `countries.js`
   (complete ISO-3166 list + `findCountry`), `addressParser.js` (`parseAddress`,
   `deriveFields`). PlaceForm address prefill replaced with chip UI; live-apply
   via `useEffect` on `addrSegments`.
11. **DONE** — Blob notepad smart-paste. New `blobParser.js` + `BlobPreview.jsx`.
    QUICK PASTE section at top of PlaceForm; routes URL/hours/address/name to
    existing parsers; APPLY writes all non-null extracted values to form state.
    Social links (Facebook/Instagram) shown in preview, not written to any field.
12. **DONE** — Bug fixes: midnight-close badge (00:00 → 1440 min), alternating
    hours blob format, multi-type URL routing (untappd/website/social), Maps URL
    paste hint in edit mode.
13. **DONE** — Blob display fixes (URL truncation, blank-line chips), city parse
    fixes (lone-digit ignore, last-city-chip), card name → Maps link,
    brewery + park types added to constants.
14. **DONE** — Venue traits: `VENUE_TRAITS` export in constants.js (8 entries);
    trait chip row in PlaceForm above scheduling hints; trait filter `<select>`
    in App.jsx toolbar. Traits stored in existing `tags` array. If trait filter
    silently fails, fix to `parseTags(p.tags || '').includes(filterTrait)` in
    App.jsx useMemo (tags may be a string, not an array).
15. **DONE** — Flight email parser. New `flightParser.js`: two-pass Wizzair +
    generic fallback, DD/MM/YYYY Israeli locale, airline prefix map
    (W6/FR/VY/U2/LY/6H/IZ). Collapsible PASTE FLIGHT EMAIL in TripForm;
    auto-parses on paste; APPLY writes both legs + sets trip dates if empty.
    Also: `blobParser.js` ▢-char filter (Google Maps box separators no longer
    produce stray NAME chips).
16. **DONE** — Accommodation check-in/out fields. `db.js` version(3) bump;
    `checkIn`/`checkOut` defaults in `repo.js`; conditional time inputs in
    PlaceForm (type === accommodation only); card display in steel mono.
17. **DONE** — Bulk place paste. New `BulkPaste.jsx` + `BulkPaste.css`.
    Paste N names, normalised dedup match against library (exact/likely/new),
    city-filter pre-narrowing, confirmation-only merge, stub create via `addPlace`.
    Also: blob parser gains `checkin`/`checkout` roles (extracts HH:MM, applies
    to `setCheckIn`/`setCheckOut` on APPLY); `happy-hours` trait added to
    `VENUE_TRAITS`; `ignore-label` role filters Google Maps section headers
    (Lunch, Happy hours, Kitchen, etc.) from blob classification.
18. **DONE** — Toolbar consolidation. IMPORT CSV + IMPORT XLSX moved to
    AdminModal (IMPORT DATA section). BULK PASTE moved into split button
    chevron dropdown alongside ADD PLACE. INCOMPLETE filter moved to statusbar
    as clickable rust badge (hidden when count = 0). Split button:
    `[+ ADD PLACE][▾]` — primary always one-click, chevron reveals dropdown.
19. **DONE** — State/region field + grouped city filter. `db.js` version(4),
    `state` indexed on places; `state` default in `repo.js`; STATE/REGION input
    in PlaceForm LOCATION row; `deriveFields` returns `{ city, state, country,
    address }`; `state` chip role (amber) in address cycler; city+state display
    on PlaceCard + PlaceList; city dropdown grouped by country via `<optgroup>`.
20. **DONE** — Block time-ranges, flight placement by time, nearby auto-suggest.
    New `haversine.js`. BLOCKS gain `start`/`end` hour fields. `blockForTime()`
    places flights in correct block by depTime/arrTime (handles 12h AM/PM format).
    Per-day greying: arrival day dims blocks before landing; departure day dims
    blocks after departure. SlotCell gains `dimmed` prop + `◈ NEARBY` button.
    Nearby suggest panel: haversine scoring + hours overlap, top 8, fixed
    bottom-right overlay. Falls back to full picker when no anchor with coords.
21. **DONE** — Flight dep/arr dates on both legs. `depDate`/`arrDate` added to
    flight objects (no schema bump). TripForm: date inputs alongside time inputs,
    overnight warning, smart pre-fill from trip dates. TripGrid: flight cards
    placed by `flight.depDate`, grid extends to `inboundFlight.arrDate` if after
    `endDate`. Greying uses flight dates not trip dates. IN/OUT labels swapped:
    IN = arriving at destination, OUT = leaving destination.
22. **DONE** — BLOCKS restructure: `early_morning` added (🌙 00–06, order 0);
    all orders shifted; `evening` end extended to 00 (midnight); `night` key
    unchanged but label → Night Stay, emoji → 🏠, `start`/`end` → null (timeless).
    `blockForTime` skips null-time blocks. Nearby suggest skips night block.
    `blockEnd=0` guard added (evening end=0 → 1440 mins).

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
