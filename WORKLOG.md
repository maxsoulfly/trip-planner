# Worklog

---

### 2026-06-17 — Commit A: pm inference, today pip, permanently closed, supermarket, scheduling chips

- **Done:**
    - `src/utils/hoursParser.js` — `parseHoursValue` now applies pm inference: after both sides parse, if `rawClose` has an explicit `pm` suffix and `rawOpen` has no `am`/`pm`, the function appends `' pm'` to `rawOpen` and retries; uses the pm result only if it produces a logical range (`open < close`). Example: `"2–10:30 pm"` → `14:00–22:30` instead of `02:00–22:30`. 24h ranges like `"10–22:00"` are unaffected (no `pm` keyword on close side). Inference rule documented in a comment.
    - `src/db/constants.js` — three schema changes: (1) `shop` emoji changed from `🛒` to `🏪` to differentiate it; (2) new `supermarket` entry (`🛒`) inserted after `shop`; (3) new `permanently_closed` status (`✕`, `'Permanently closed'`) added as last entry in `STATUSES`. All downstream UI picks up via `PLACE_TYPES` and `STATUSES` arrays.
    - `src/components/PlaceCard.jsx` — added `permanently_closed` entry to the `STAMP` map: `{ label: '✕ CLOSED', cls: 'stamp--dead' }`.
    - `src/components/PlaceCard.css` — (1) `.pip--today` rewritten: full amber-inverted style (`background: var(--amber)`, `color: var(--bg)`, `border-color: var(--amber)`, `font-weight: 700`, `font-size: 13px`, `opacity: 1`, `box-shadow: 0 2px 0 0 var(--amber)` for underline). Since `.pip--today` is declared after `.pip--closed`/`.pip--open`/`.pip--unknown` in the file, it overrides all state-specific styles including the 0.35 opacity on closed days. (2) Added `.stamp--dead { color: var(--rust); transform: rotate(-7deg); }` — more aggressive rotation than the base stamp to signal a dead place.
    - `src/App.jsx` — `isIncomplete`: added early return `if (p.status === 'permanently_closed') return false` at the top, so archived closed places are never flagged as incomplete.
    - `src/components/PlacePicker.jsx` — `placesList` now filters `p.status !== 'permanently_closed'` before the city/type/search filter chain, so permanently closed places never appear in slot assignment.
    - `src/components/PlaceForm.jsx` — added `SCHEDULING_TAGS` module-level constant (`['breakfast', 'specialty-coffee', 'brunch', 'lunch', 'dinner', 'late-night']`). Added `toggleSchedulingTag(tag)` function: parses current `tags` string via existing `parseTags`, adds or removes the tag, joins back with `', '`. In NOTES & TAGS fieldset, added a `<div className="sched-hints">` block above the freeform tags input: label "SCHEDULING HINTS" + a row of toggle chips; each chip calls `toggleSchedulingTag` on click and gets class `sched-chip--on` when the tag is present in `parseTags(tags)`.
    - `src/components/PlaceForm.css` — added `.sched-hints`, `.sched-hints-label`, `.sched-chips`, `.sched-chip`, `.sched-chip--on` styles. Chips are mono pill buttons (999px radius), `--line` border and `--dim` text when off, `--amber` border and text when on. No new fieldset or DOM structure needed outside the existing `form-section`.
- **Deviations:** None.
- **Schema/contract changes:** `constants.js` — added `supermarket` to `PLACE_TYPES`, changed `shop` emoji, added `permanently_closed` to `STATUSES`. No `db.js` change (these are display-only enums; stored string values are self-describing). No `repo.js` change.
- **Known issues / TODO:** Existing `shop`-type places in the DB retain the `shop` key — they'll now render with `🏪` instead of `🛒`, which is the intended change. Existing places with `status: 'wishlist'` etc. are unaffected.
- **Next:** Manual data cleanup (city merges), then tag v0.1.

---

### 2026-06-17 — Four small fixes: postcode, hours badge, Untappd, type-suggest-after-hours

- **Done:**
    - `src/components/PlaceForm.jsx` — `parseAddressString`: fixed postcode strip. Old regex `/^\d+\s*/` only stripped digits, leaving `-124 Kraków` for Polish postcodes like `31-124`. New two-pass: first try `/^\d{2}-\d{3}\s*/` (Polish XX-XXX format), then `/^\d{4,5}\s*/` (generic 4–5 digit codes). City now parses correctly from Plus-code address fields.
    - `src/components/PlaceCard.jsx` — replaced the 3-state `todayHours`/`isOpen`/`isClosed` variables with a `getStatusBadge(openingHours, todayKey)` helper. Returns `null` for unknown (absent key → renders `—`); `{ label: 'CLOSED', cls: '--closed' }` for `null` entry; or one of four time-aware states: `OPEN` (now within window, amber bold), `OPENS SOON · HH:MM` (≤15 min before open, amber), `OPENS HH:MM` (>15 min before open, steel), `CLOSED TODAY` (after close window, rust). Badge label replaces the static hours range string. Added `▸ UNTAPPD` link in `.card-links` after the Maps link (only rendered when `place.untappdUrl` is set).
    - `src/components/PlaceCard.css` — added `.hours-readout--steel { color: var(--steel); }` (used for the "OPENS HH:MM" state).
    - Type suggestion after hours paste — confirmed already wired: `handleHoursParse` in `PlaceForm.jsx` already calls `detectType(name)` and sets `suggestedType` after successful parse. No code change needed.
- **Deviations:** None.
- **Schema/contract changes:** None.
- **Known issues / TODO:** None introduced.
- **Next:** Manual data cleanup (city merges Krakow→Kraków, Warsaw→Warszawa), then tag v0.1.

---

### 2026-06-17 — Type detection expansion + trip date UX

- **Done:**
    - `src/components/PlaceForm.jsx` — `TYPE_KEYWORDS` converted from a plain object to an ordered array of `[typeKey, keywords[]]` pairs, so iteration priority is guaranteed. Expanded from 4 entries to 8, covering the full beer taxonomy in priority order: `bottle_shop` ('beer shop', 'bottle shop', 'beer store', 'beerstore') → `brewpub` ('brewpub', 'brew pub', 'beer & food', 'beer and food', 'brewery', 'browar', 'brauerei', 'brewing', 'pivovar') → `taproom` ('taproom', 'tap room', 'beer bar', 'craft beer', 'beer') → `restaurant` ('restaurant', 'bistro', 'brasserie', 'ristorante') → `cafe` ('café', 'cafe', 'coffee', 'kawiarnia', 'kaffee') → `bar` ('bar') → `museum` ('museum', 'muzeum', 'muzej', 'gallery', 'galeria', 'galeri') → `accommodation` ('hotel', 'hostel', 'noclegi', 'apartment', 'apartament', 'pension', 'inn'). `detectType` updated to iterate the array directly (was `Object.entries`). Added two lines to `handleHoursParse`: after hours merge succeeds, re-runs `detectType(name)` and sets `suggestedType` if a match is found and doesn't match the current type.
    - `src/components/TripForm.jsx` — added `endDateRef = useRef(null)`. START DATE `onChange` expanded: stores the new value, clears `endDate` if it was already set and is now before the new start, then `setTimeout(() => endDateRef.current?.focus(), 0)` opens the END DATE picker immediately after React re-renders. END DATE input gains `ref={endDateRef}` and `min={startDate || undefined}` — prevents picking before start and causes the calendar to open on the same month as startDate.
- **Deviations:** None — implemented exactly as planned.
- **Schema/contract changes:** None.
- **Known issues / TODO:** None introduced.
- **Next:** Manual data cleanup (city merges), then tag v0.1.

---

### 2026-06-17 — Step 7 Commit B: UI polish (5389448)

- **Done:**
    - `src/db/db.js` — bumped to `version(2)` (additive); added `websiteUrl` to places record shape comment. Existing records get `websiteUrl: undefined` which the UI treats as empty string.
    - `src/db/repo.js` — added `websiteUrl: ''` to `addPlace` defaults; added `mergeCities(sourceCity, targetCity)` — `db.places.where('city').equals(source).toArray()` then `Promise.all(map put)` with `city: targetCity` and refreshed `updatedAt`.
    - `src/styles.css` — appended shared modal shell: `.modal-backdrop`, `.modal-panel` (max-width 600px default), `.modal-header`, `.modal-title`, `.modal-close`, `.sr-only`. Used by all 6 modals.
    - `src/main.jsx` — reads `localStorage.getItem('theme') || 'dark'` and sets `document.documentElement.setAttribute('data-theme', saved)` before React mount; prevents flash-of-wrong-theme.
    - `src/App.jsx` — theme state (`dark`/`light`/`system`), `cycleTheme()`, `setTheme()` with localStorage write; `◐ DARK` / `☀ LIGHT` / `⊙ SYS` button in statusbar. `listView` state; CARDS/LIST toggle in toolbar. `handleBulkDelete(ids)` calls `deletePlace` for each and reloads. Mounts `<PlaceList>` when `listView === true`; `<PlaceCard>` grid when false. Removed `window.confirm` from all delete handlers — inline confirm via `PlaceCard` state (Commit A already done).
    - `src/App.css` — added `.btn-theme`, `.btn-view-group`, `.btn-view`, `.btn-view--active`.
    - `src/components/PlaceForm.jsx` — `websiteUrl` field (LINKS fieldset). `suggestedType` state: on name input blur/change, `detectType(name)` checks against `TYPE_KEYWORDS` dict (museum/accommodation/brewpub/cafe); shows inline "Suggest: X → USE / ✕" strip below TYPE select. Address prefill enhanced: plus code pattern (`/^[A-Z0-9]{4,8}\+[A-Z0-9]{2,3}\s+(.*)/i`) strips the code and parses the rest. Modal title fixed: `◈ NEW CACHE` → `◈ NEW PLACE`, `◈ EDIT CACHE` → `◈ EDIT PLACE`.
    - `src/components/PlaceForm.css` — removed modal shell (now in styles.css); added `.type-suggest`, `.type-suggest-btn`, `.type-suggest-dismiss`.
    - `src/components/PlaceCard.jsx` — `confirming` state + inline REALLY?/CONFIRM/CANCEL pattern (no `window.confirm`). `websiteUrl` link in `.card-links` wrapper.
    - `src/components/PlaceCard.css` — `.card-links` wrapper div, `.website-link`, `.card-confirm-row`, `.card-confirm-label`, `.card-btn--confirm` styles.
    - `src/components/PlaceList.jsx` (new) — compact list view with checkbox selection, bulk delete with inline confirm. Table-like layout: checkbox | type emoji | name (→ onEdit) | city | status stamp | EDIT button.
    - `src/components/PlaceList.css` (new) — `.pl-*` namespace, grid layout, bulk bar, selection highlight.
    - `src/components/TripList.jsx` — `TripCard` gets `confirming` state for inline delete confirm. `TripList` sorts `trips` before render: empty `startDate` → bottom (ascending date otherwise).
    - `src/components/TripList.css` — `.trip-confirm-row`, `.trip-confirm-label`, `.trip-btn-confirm:hover` styles.
    - `src/components/SlotCell.jsx` — `onMoveUp`/`onMoveDown` props; ↑↓ buttons (`sc-move-btn`) on each item (disabled when first/last); removed TODO comments.
    - `src/components/SlotCell.css` — `.sc-item-controls`, `.sc-move-btn` styles.
    - `src/components/TripGrid.jsx` — imports `putScheduleItem`; `handleMoveItem(item, direction)` materialises sequential order indexes then swaps two adjacent items; passes `onMoveUp`/`onMoveDown` to SlotCell.
    - `src/components/AdminModal.jsx` — city merge section: on mount loads all cities; two select dropdowns (source → target), MERGE with inline confirm, calls `mergeCities()`. Modal class renames: `admin-backdrop` → `modal-backdrop modal-backdrop--center`, `admin-panel` → `modal-panel admin-panel`, `admin-header` → `modal-header`, `admin-title` → `modal-title admin-title`, `admin-close` → `modal-close`.
    - `src/components/AdminModal.css` — removed modal shell; added `.modal-backdrop--center { align-items: center }`, `.admin-panel { border-radius: 10px; max-width: 420px; max-height: 90vh }`, `.admin-title` font override (11px/.18em/uppercase vs shared 12px/.14em); city merge styles (`.admin-merge-fields`, `.admin-merge-select`, `.admin-merge-arrow`).
    - `src/components/TripForm.css` — removed duplicated modal shell block and `.sr-only`.
    - `src/components/CsvImport.jsx` — modal classes renamed to `modal-*` (backdrop, panel, header, title, close); `.ci-panel` kept as secondary class for sizing.
    - `src/components/CsvImport.css` — removed shell block + `.sr-only`; added `.ci-panel { max-width: 560px }`.
    - `src/components/XlsxImport.jsx` — modal classes renamed to `modal-*`; `.xi-panel` kept.
    - `src/components/XlsxImport.css` — removed shell block + `.sr-only`; added `.xi-panel { max-width: 480px }`.
    - `src/components/PlacePicker.jsx` — modal classes renamed to `modal-*`; `.pp-panel` kept.
    - `src/components/PlacePicker.css` — removed shell block + `.sr-only`; added `.pp-panel { max-width: 480px; max-height: calc(100vh - 60px) }`.
    - `src/utils/xlsxImport.js` — canonical city names: `'Warsaw'` → `'Warszawa'`, `'Krakow'` → `'Kraków'` in all city-value assignments in `extractGrid`, `debugGrid`, `GRID_SHEETS`, and `parseXlsxWorkbook` call sites. Sheet name strings (used for `===` comparison) unchanged.
- **Deviations:** None.
- **Schema/contract changes:** `db.js` bumped to version(2), `websiteUrl` field added (additive). `repo.js` — added `mergeCities` and `websiteUrl` default in `addPlace`.
- **Known issues / TODO:** Existing places from the XLSX import have city='Krakow'/'Warsaw' — use AdminModal city merge tool to rename them to Kraków/Warszawa. PlaceForm hours editor pre-existing issue (initialises all 7 days to null instead of absent) deferred.
- **Next:** Manual data cleanup (city merge Krakow→Kraków, Warsaw→Warszawa), then tag v0.1.

---

### 2026-06-17 — Step 7 bug fixes (pre-Commit-A)

- **Done:**
    - `src/App.jsx` — replaced `isIncomplete(p)` with corrected definition: returns true if `type === 'other'`, OR if type is in the "should have hours" set (`taproom`, `bottle_shop`, `brewpub`, `bar`, `restaurant`, `cafe`, `museum`, `activity`, `shop`) AND `openingHours` has 0 keys. Removed the `!googleMapsUrl` condition that was causing false positives on almost every imported place.
    - `src/components/PlaceForm.jsx` — (Fix 2) added `backdropRef` and `mouseDownTarget` refs; updated `handleBackdropClick` to require both mousedown and mouseup on the backdrop element before closing; added `ref` + `onMouseDown` to the backdrop div. (Fix 3) added `handleUrlFieldPaste` function that calls `parseMapsUrl` on the pasted text and fills `lat`/`lng` (always) and `name` (only if currently empty); wired it as `onPaste` on the GOOGLE MAPS URL input — does not call `e.preventDefault()` so the URL still populates the field normally.
    - `src/components/TripForm.jsx` — Fix 2: same backdropRef/mouseDownTarget pattern.
    - `src/components/CsvImport.jsx` — Fix 2: added `useRef` to import; same backdropRef/mouseDownTarget pattern.
    - `src/components/XlsxImport.jsx` — Fix 2: added `useRef` to import; same backdropRef/mouseDownTarget pattern; preserved existing `!importing` guard.
    - `src/components/AdminModal.jsx` — Fix 2: same backdropRef/mouseDownTarget pattern alongside existing `fileRef`; preserved existing `!busy` guard.
    - `src/components/PlacePicker.jsx` — Fix 2: added `useRef` to import; same backdropRef/mouseDownTarget pattern.
- **Deviations:** None.
- **Schema/contract changes:** None.
- **Known issues / TODO:** None introduced.
- **Next:** Commit these fixes, then commit Step 7 Commit A (all features already in place).

---

### 2026-06-15 — Step 7 Commit A: data quality + admin features

- **Done:**
    - `src/utils/hoursParser.js` (new) — pure `parseGoogleHours(text)` → partial `openingHours` object. Handles Format A (alternating day/hours lines, Google Maps desktop copy-paste) and Format B (day: hours per line). Day ranges expand ("Monday–Friday" → mon–fri). `"Closed"` → `null`; `"Open 24 hours"` → `{open:'00:00', close:'24:00'}`; bare-hour tokens ("12") treated as HH:00 to handle "12 – 10 pm". Only sets keys for explicitly mentioned days — absent = unknown per data contract.
    - `src/db/repo.js` — added `clearAllTrips()` (trips + scheduleItems in one `rw` transaction, no orphaned items), `clearAllData()` (all three tables), `exportAll()` (returns `{places, trips, scheduleItems}` arrays), `importAll(data)` (validates `data.places` array guard, then clears + `bulkPut` all tables in one transaction). Removed TEMP comment from `clearAllPlaces`.
    - `src/components/AdminModal.jsx` (new) — `⚙ ADMIN` modal with: Export JSON (download as `trip-planner-backup.json`), Import JSON (file input → `importAll` → error displayed inline if validation fails), Clear Places / Clear Trips / Clear All Data (each with inline REALLY?/CONFIRM/CANCEL row, no `window.confirm`). `onRefresh` prop reloads places + trips in App.
    - `src/components/AdminModal.css` (new) — `admin-*` namespace, matches design language.
    - `src/components/PlaceCard.jsx` — added `incomplete` prop; renders `⚠` in `.card-eyebrow` (right-aligned via flex) when true. Stamp not affected (it's `position:absolute`).
    - `src/components/PlaceCard.css` — `.card-eyebrow` now `display:flex; justify-content:space-between`; `.card-stub` in `--rust`.
    - `src/components/PlaceForm.jsx` — added `parseAddressString` local helper (splits on `,`, strips leading postcode from city segment); address prefill input with auto-parse on paste + PARSE button in LOCATION fieldset. Added `parseGoogleHours` import and hours paste textarea with auto-parse on paste + PARSE button in OPENING HOURS fieldset; merges into existing `hours` state (only overwrites mentioned days).
    - `src/components/PlaceForm.css` — `.prefill-textarea` for the multi-line hours paste input.
    - `src/App.jsx` — `isIncomplete(p)` module-level helper; `filterIncomplete` state + `⚠ INCOMPLETE` toggle button in toolbar (rust-colored when active); `filterIncomplete` AND-ed into `filtered` useMemo; `showAdmin` state + `⚙ ADMIN` button in statusbar; `<AdminModal>` mount; `statusbar-right` wrapper div for admin button + tab switcher; removed temp `⚠ CLEAR PLACES` button and `clearAllPlaces` import.
    - `src/App.css` — `.statusbar-right`, `.btn-admin`, `.btn-import--active` (rust border/text when incomplete filter is on).
- **Deviations:** None from the approved plan.
- **Schema/contract changes:** `repo.js` — four new exports (`clearAllTrips`, `clearAllData`, `exportAll`, `importAll`). No `db.js` or `constants.js` changes.
- **Known issues / TODO:** `PlaceForm` hours editor initializes all 7 days to `null` (closed) rather than absent (unknown) — pre-existing issue, unknown/closed distinction is collapsed in the UI. Deferred.
- **Next:** Step 7 Commit B — theme toggle, compact list view + bulk delete, modal CSS extraction, slot reorder, trip list sort fix, `window.confirm` → inline confirmation for deletes.

---

### 2026-06-15 — Step 6b: XLSX token filter pass + seeding prep

- **Done:** Two iterative filter-improvement passes on `src/utils/xlsxImport.js` driven by a diagnostic script (`diagnose.mjs`, temporary, not committed). No UI or schema changes.
    - `cleanName`: added FIX-9 (strip trailing hours-annotation parens `(From 10)`, `(7:30-16)`), FIX-9b (strip `(?)` confidence marker), FIX-1k (strip trailing ` -` fragment).
    - `isNonVenue`: added FIX-1a–1l (parens-prefix, airport+time codes, From/Until openers, Option N labels, standalone times, day-block labels, date strings, day names, transit labels, digit-only tokens), FIX-2 (date with day-name prefix), FIX-3 (AIRLINE_RE for named airlines, FLIGHT2_RE for spaced flight codes), FIX-4 (reject tokens with no Latin letters), FIX-5 (✈ prefix), FIX-6 (open-from/opens-at phrases), FIX-7 (exact-match blocklist: budget labels, direction labels).
    - `parseHebrewTable`: fixed column offset — venue names are in col 1 (not col 0) in both Bucharest JUN 2024 and Krakow+Warsaw Apr 2024 (col 0 is blank in those sheets).
    - `inferType` (new): infers `accommodation` for street-address-pattern names (`ul.`, `str.`, `strada`, `noclegi`, `hotel` prefix, `titanic` substring, ≥3-word names ending in a street number). Used in `extractGrid` instead of hardcoded `'other'`.
    - `parseXlsxWorkbookDebug` (new export, temporary): mirrors each extraction path and records all candidate tokens with `{raw, cleaned, sheet, path, city, accepted}` for diagnostic use. Remove before shipping.
    - Final parser output: 203 places (151 type=other, 8 accommodation, rest bar/taproom/bottle_shop from structured sheets). ~20 noise names still accepted (multiline fragments, date strings, description text) — flagged for manual deletion after import.
    - `src/db/repo.js`: added `clearAllPlaces()` (temp, one-liner — remove after seeding).
    - `src/App.jsx`: added temporary "⚠ CLEAR PLACES" button in toolbar wired to `clearAllPlaces` + confirm dialog. Remove after seeding.
- **Deviations:** Diagnostic scripts (`diagnose.mjs`, `inspect_hebrew.mjs`, `list_other.mjs`) left in project root, not committed — temporary tooling.
- **Schema/contract changes:** none.
- **Known issues / TODO:**
    - Noise still accepted: `Apr 9/14` date strings, `in Warsaw` fragment, `🍻 beer board`, description fragments (`and Bulgarian wine`, `Craft beer. Craft food.`), arrow-concatenated strings (`Pivoteka -> Pop Up ->`), multiline-split museum names. Delete manually after import.
    - `Diter Hotel` imports as type=other (suffix "Hotel" not caught by inferType prefix pattern). Edit manually.
    - `clearAllPlaces`, temp button, and `parseXlsxWorkbookDebug` export should be removed after seeding run is confirmed good.
- **Next:** Run seeding import in browser, delete noise entries, then move to Step 7 (polish) or remove temp seeding tooling first.

---

### 2026-06-14 — Step 1: Scaffold + data layer

- **Done:** Vite + React scaffold; Dexie schema (`places`, `trips`, `scheduleItems`);
  `repo.js` as sole DB access layer; `constants.js` controlled vocabularies;
  `hours.js` helpers; `seed.js` dummy data; smoke-test `App.jsx` proving round-trip.
- **Deviations:** None.
- **Schema/contract changes:** Initial schema. `BudgetEntry` deferred to a future
  `version(2)` as per spec.
- **Known issues:** `App.jsx` is throwaway; replaced in step 2.
- **Next:** Place library UI.

---

### 2026-06-14 — Step 2: Place library UI

- **Done:** Replaced smoke-test `App.jsx` with real Place Library (search + filter by
  city/type/status, add/edit/delete, opening-hours editor, Open-in-Maps).
  CSS custom-property theming (`dark`/`light`/`system`) on `<html>` via `[data-theme]`.
  Status stamps (☆ FLAGGED / ◐ MARKED / ✓ SECURED). IBM Plex Mono for all data fields.
  New files: `App.css`, `PlaceCard.jsx/css`, `PlaceForm.jsx/css`.
- **Deviations:** `data-theme` on `<html>` (not `.stage` like the mock) — matches
  CLAUDE.md spec. `system` theme is pure CSS (`@media prefers-color-scheme`), no JS.
  Visible theme toggle deferred. Trips count in statusbar hardcoded `0` until step 4.
- **Schema/contract changes:** None. Data layer untouched.
- **Known issues:** Trips count hardcoded. `window.confirm` for delete is OS-native.
  Hours "unknown" (`{}`) vs "closed" (`null`) semantic noted as important (see below).
- **Next:** Maps-link prefill + CSV import.

---

### 2026-06-14 — Step 3: Maps-link prefill + CSV import

- **Done:**
    - `src/utils/mapsParser.js` — pure `parseMapsUrl(url)` function. Extracts name
      from `/maps/place/` or `/maps/search/` segment; lat/lng from `@LAT,LNG` anchor.
      Returns `{ short: true }` for `maps.app.goo.gl` short URLs (can't resolve
      client-side). Comment block documents all URL shapes + what each yields.
    - `PlaceForm.jsx` — prefill strip at top of add form. Auto-parses on paste
      (`onPaste` → `e.clipboardData.getData`), PARSE button as fallback. Fills name,
      lat, lng, googleMapsUrl. Short-URL warning: _"Short link detected. Open it in
      your browser, then copy the URL from the address bar."_ Strip hidden in edit mode.
    - `src/components/CsvImport.jsx/css` — 3-step modal: upload (Papaparse) →
      map columns (auto-detect + user-adjustable selects) → preview + confirm.
      Preview shows first 5 valid rows + count line: "N will import · M skipped (no name)".
      `openingHours` left as `{}` (absent = unknown) per data contract.
    - `App.jsx` — `IMPORT CSV` button in toolbar (ghost style); `showImport` state.
    - Installed: `papaparse`.
- **Deviations:** None.
- **Schema/contract changes:** None. `openingHours: {}` from CSV import intentionally
  leaves all days absent (unknown), not `null` (closed). This is correct per the
  data contract ratified in CLAUDE.md.
- **Known issues:** Auto-detect mapping uses exact normalized-header matching — works
  well for common header names, may need manual adjustment for unusual exports.
  No per-row import progress (all-or-nothing; fast for typical library sizes).
- **Next:** Step 4 — Trips: date × block grid, assign places, flights,
  accommodation, ad-hoc items.

---

### 2026-06-14 — Step 4a: Trip list + form (commit A)

- **Done:**
    - `src/utils/dates.js` (new) — `parseLocal(dateStr)` splits `'YYYY-MM-DD'` and calls `new Date(y, m-1, d)` to avoid UTC offset day-shift (Israel = UTC+2/+3). `daysInRange(start, end)` returns `['YYYY-MM-DD', ...]` for every day inclusive. `formatDayHeader(dateStr)` returns `'MON · Jun 14'` format for the grid header (commit B).
    - `src/db/repo.js` — added `deleteTripCascade(tripId)`: Dexie `rw` transaction that deletes all `scheduleItems` where `tripId` matches, then deletes the trip. Everything else untouched.
    - `src/components/TripList.jsx` (new) — `TripCard` sub-component: amber corner accent, `TRIP` eyebrow (mono), Space Grotesk title, cities joined with `·`, date range + day count, outbound/inbound flight summaries if set, OPEN GRID (amber) + EDIT + DEL (ghost) action buttons. `TripList`: `TRIPS//` heading, `+ NEW TRIP` button, empty state `"No trips yet — plan your first expedition."`, 2-col cards grid. Receives all data and handlers as props — fetches nothing itself.
    - `src/components/TripList.css` (new) — 2-col trip card grid (→ 1-col at ≤620px), `.trip-card-corner` (absolute-positioned amber L-bracket), eyebrow/title/cities/dates/flight/action styles, `.trip-btn-open` (amber fill), `.trip-btn-ghost` + `.trip-btn-danger` (hover rust).
    - `src/components/TripForm.jsx` (new) — `FlightFields` inline sub-component with 6 inputs (FROM/DEP/→/TO/ARR, AIRLINE, NUMBER; FROM+TO uppercase-forced 4-char IATA). Four fieldset sections: DETAILS (title, cities, start+end date, notes), OUTBOUND FLIGHT (hidden checkbox + `hours-badge` SET/NOT SET toggle), INBOUND FLIGHT (same), ACCOMMODATION (search input + checklist or empty-library hint). Validation: title + both dates required, startDate ≤ endDate. `accomPlaces` loaded from `getAllPlaces()` filtered to `type === 'accommodation'`. `accomSearch` state filters by name or city case-insensitively; "no matches" shown when search has no hits. ESC closes via `keydown` listener; backdrop click closes on `e.target === e.currentTarget`. Calls `addTrip`/`putTrip` then `onSave()`; shows error banner and stays open on Dexie failure.
    - `src/components/TripForm.css` (new) — modal shell duplicated from PlaceForm.css (intentional, noted as extraction candidate). Flight styles: `.flight-fields`, `.flight-row`, `.tf-iata` (56px), `.tf-flight-num` (100px), `.tf-grow`. Hours-badge (SET amber / NOT SET dim). Accommodation: `.accom-list`, `.accom-row`, `.accom-name`, `.accom-city`.
    - `src/App.jsx` (rewritten) — `trips` state + `loadTrips()`; both loaded on mount. `switchView(v)` resets `activeTrip`, closes place modal + CSV import (not tripModal). Statusbar: `N CACHES · M TRIPS`. Tab switcher: CACHES | TRIPS buttons. Trips view: `!activeTrip` → `<TripList>`; `activeTrip` → `.grid-placeholder` with `← TRIPS` back button + trip title + "grid coming in commit B". `tripModal` state drives TripForm. `handleDeleteTrip` confirms then cascades. `handleTripSaved` nulls tripModal and reloads trips.
    - `src/App.css` (edited) — added `.tab-switcher`, `.tab-btn`, `.tab-btn--active` (amber bg); `.grid-placeholder`, `.grid-placeholder__msg`, `.btn-back` (amber, no border).

- **Deviations:**
    - Commit split: user requested A (list + form) before B (grid). This is commit A.
    - Accommodation: original plan injected into grid night cells. User rejected; will instead appear as a trip-level reference block in the grid header (commit B).
    - EXPEDITIONS → TRIPS: all navigation labels renamed (statusbar, tab, heading, eyebrow, buttons, modal title). Flavor body text `"plan your first expedition"` kept.
    - Accommodation search: added at user's request — not in the original step 4 plan.

- **Schema/contract changes:** `repo.js` only — added `deleteTripCascade(tripId)`. `db.js` and `constants.js` untouched.

- **Known issues / TODO:**
    - ~~User reported 10-point checklist failures: create/edit/delete not reflecting in list, OPEN GRID shows empty page, back arrow unresponsive.~~ Resolved by clearing IndexedDB in DevTools — schema conflict from pre-trips browser DB. No code change needed. All checklist items pass.
    - `TripForm.css` duplicates modal shell from `PlaceForm.css` — tech debt, extract to `styles.css` in a later cleanup.
    - No search/filter on the trip list itself.
    - `getAllTrips()` sorts by `startDate`; trips with empty startDate sort to the front.

- **Next:** Step 4b — TripGrid, SlotCell, PlacePicker (commit B).

---

### 2026-06-14 — Step 4b: Day × block grid (commit B)

- **Done:**
    - `src/components/TripGrid.jsx` (new) — top-level grid component. Props: `trip`, `onBack` (view state stays in App.jsx — TripGrid calls `onBack()`, never touches view state directly). On mount, loads `getScheduleForTrip(trip.id)` and `getAllPlaces()` in parallel; builds an `id → place` map for O(1) lookup. State: `scheduleItems`, `places`, `picker` (null | `{ date, block }`). Renders: header row with `← TRIPS` back button, trip title, cities; accommodation strip (if `trip.accommodationPlaceIds` non-empty — names looked up from places map, shown once above the grid, not in any night cell); horizontally-scrolling flex row of day columns from `daysInRange`. Each day column has one SlotCell per BLOCKS entry. Outbound flight injected as a static `flightCard` into morning of `trip.startDate`; inbound into morning of `trip.endDate` (both land in the same column on single-day trips). After remove or confirm, re-fetches. If trip has no dates, shows prompt to edit the trip.
    - `src/components/TripGrid.css` (new) — `.tg-root` flex column; `.tg-header` dashed border-bottom flex row; `.tg-back` amber no-border button; `.tg-accom-strip` panel-bg pill with steel ACCOMMODATION label; `.tg-days` flex row `overflow-x: auto` with thin scrollbar; `.tg-day-col` `flex: 0 0 210px`; `.tg-day-header` mono amber with 2px amber underline.
    - `src/components/SlotCell.jsx` (new) — Props: `block` (full `{ key, label, emoji, order }` object), `items` (filtered by date+block by TripGrid — never queries Dexie), `places` (id map), `flightCards`, `onAdd`, `onRemove`. Renders block label with emoji; static flight cards (OUT/IN badge, route, number; no remove button); sorted schedule items: `kind === 'place'` shows `typeMeta(place.type).emoji` + name; `kind === 'note'`/`'transport'` shows 📝/🚌 + `adHoc.label`. Each mutable item has ✕ remove button (hover rust). `// TODO: up/down reorder (polish step)` comment on each item row. `+ ADD` dashed button at bottom.
    - `src/components/SlotCell.css` (new) — `.sc-root` panel border rounded, min-height 56px; flight card with steel border; item rows with truncating name; dashed + ADD ghost button, amber on hover.
    - `src/components/PlacePicker.jsx` (new) — Props: `date`, `block`, `trip`, `places` (id map), `onConfirm`, `onClose`. ESC closes. Two tabs: **FROM LIBRARY** and **AD-HOC**. Library: text search (name or city), type dropdown, "Show all cities" checkbox (defaults to checked when `trip.cities` is empty; otherwise defaults to city-filtered). Place buttons call `addScheduleItem({ kind: 'place', placeId })` then `onConfirm()`. Ad-hoc: NOTE 📝 / TRANSPORT 🚌 radio as styled visual toggle (`sr-only` input), free-text label, ◈ ADD submit — calls `addScheduleItem({ kind, adHoc: { label } })` then `onConfirm()`. Backdrop click closes.
    - `src/components/PlacePicker.css` (new) — modal shell (3rd duplication, noted for cleanup). Mode tabs with 2px amber underline on active. Library: search + select row, show-all checkbox, scrollable place list with amber-border hover. Ad-hoc: kind toggle buttons (amber when active), text input, amber submit.
    - `src/App.jsx` (edited) — added `TripGrid` import; replaced `grid-placeholder` div with `<TripGrid trip={activeTrip} onBack={() => setActiveTrip(null)} />`.
    - `src/App.css` (edited) — removed `.grid-placeholder`, `.grid-placeholder__msg`, `.btn-back` (now in TripGrid.css).

- **Deviations:**
    - Reorder deferred as planned — `// TODO: up/down reorder (polish step)` comments left in SlotCell.
    - `order: 0` written for all new schedule items; items render in IndexedDB insertion order (stable, harmless until reorder is implemented).
    - Flight cards are never stored in `scheduleItems` — derived from `trip.outboundFlight` / `trip.inboundFlight` at render time and passed as static props to the morning SlotCell.

- **Schema/contract changes:** none — `db.js`, `repo.js`, `constants.js` untouched. `addScheduleItem` and `deleteScheduleItem` used as-is.

- **Known issues / TODO:**
    - Modal shell CSS duplicated three times (PlaceForm, TripForm, PlacePicker) — extract to `styles.css` in a later cleanup.
    - No edit-in-place for schedule items — remove and re-add is the workaround for v1.
    - Up/down reorder deferred (TODO comment in SlotCell).
    - `order: 0` on all items means sort order matches insertion order until reorder is built.

- **Next:** Step 5 — HTML day-sheet export (offline, tap-to-Maps).

---

### 2026-06-15 — Fix: flight time prefill, CACHE→PLACE rename, accommodation hours hint

- **Done:**
    - `src/components/TripForm.jsx` — added `normalizeTime(val)`: splits on `'T'` if present (handles `'YYYY-MM-DDTHH:MM'` legacy format from seed data), slices to 5 chars (`'HH:MM'`). Added `normalizeFlight(f)`: returns `EMPTY_FLIGHT` spread if falsy, otherwise spreads `f` with both time fields normalized. `outbound` and `inbound` state initialization changed from `initialData?.outboundFlight || EMPTY_FLIGHT` to `normalizeFlight(initialData?.outboundFlight)` — normalizes on load so pre-fill and save both produce `'HH:MM'` strings.
    - `src/App.jsx` — five label changes: statusbar `CACHES` → `PLACES`; tab button `CACHES` → `PLACES`; search placeholder `SEARCH CACHES…` → `SEARCH PLACES…`; add button `+ ADD CACHE` → `+ ADD PLACE`; empty state `'No caches yet — add your first place.'` → `'No places yet — add your first.'`
    - `src/components/CsvImport.jsx` — import confirm button: `` `◈ IMPORT ${validRows.length} CACHES` `` → `` `◈ IMPORT ${validRows.length} PLACES` ``
    - `src/components/PlaceForm.jsx` — after the `hours-editor` `</div>`, inside the OPENING HOURS fieldset: renders `<p className="form-hours-hint">e.g. reception hours or check-in window</p>` when `type === 'accommodation'`. No structural change to the hours editor.
    - `src/components/PlaceForm.css` — added `.form-hours-hint`: IBM Plex Mono 10px, `var(--dim)`, `letter-spacing: .06em`, `margin: 4px 0 0`.

- **Deviations:** PlaceForm modal titles (`◈ NEW CACHE` / `◈ EDIT CACHE`) left unchanged — not in the scope listed. Minor cleanup for a later polish step.

- **Schema/contract changes:** none.

- **Known issues / TODO:** PlaceForm modal header still says CACHE.

- **Next:** Step 5 — HTML day-sheet export (offline, tap-to-Maps).

---

### 2026-06-15 — Step 5: HTML day-sheet export

- **Done:**
    - `src/utils/exportHtml.js` (new) — pure `generateDaySheet(trip, scheduleItems, placesMap)` function; no React, no Dexie. Internal helpers: `esc(str)` (HTML entity escaping), `mapsUrl(place)` (priority order: googleMapsUrl → lat/lng coords URL → address search URL → null), `hoursSpan(openingHours, weekdayKey)` (returns a `<span>` with class `hours--open` / `hours--closed` / `hours--unknown`), `renderFlight`, `renderPlace`, `renderAdHoc`, `renderBlock`, `renderDay`. `buildCss()` returns all styles as a string — dark theme by default, CSS custom properties on `#content`, `#tt:checked + #content` adjacent sibling selector overrides variables for light mode (no JS). Fonts: `ui-monospace, 'Courier New', monospace` for all data; `system-ui, -apple-system, sans-serif` for body — no Google Fonts link per approved plan. Theme toggle: hidden `<input type="checkbox" id="tt">` + `<label for="tt">` with `☀ LIGHT` / `◐ DARK` spans toggled via CSS. Generated date in header topbar (right side). Accommodation strip (once, above days) with tappable Maps links where available. One `<section class="day">` per day; blocks with no content omitted; empty days get "Nothing scheduled." Flight cards injected into morning block of startDate (outbound) and endDate (inbound) from the trip object — never stored in scheduleItems. Maps button is a full-width 48px min-height `<a>` on each place card that has a resolvable URL.
    - `src/components/TripGrid.jsx` — added `import { generateDaySheet }` from exportHtml. Added `handleExport()`: calls `generateDaySheet`, builds a Blob, creates an object URL, triggers download via a programmatic `<a>` click, revokes the URL. Filename: `trip.title` with non-alphanumeric chars collapsed to `-`, trimmed, lowercased, + `.html`. Added `<button className="tg-export">EXPORT HTML</button>` to the tg-header div (right side via `margin-left: auto`).
    - `src/components/TripGrid.css` — added `.tg-export`: ghost button, IBM Plex Mono 11px, `margin-left: auto` + `align-self: center` (overrides parent's `align-items: baseline` so the button sits centered in the header row), color `var(--dim)` → `var(--ink)` on hover, border `var(--line)` → `var(--steel)` on hover.

- **Deviations:** No Google Fonts `<link>` in the export — system font stacks used throughout (explicitly requested: offline document, no delay/error on a phone with no signal). Body background stays `#0E0E0F` hardcoded in dark mode because `body` is not a descendant of `#content` and can't inherit the toggled CSS variables — visually harmless on mobile (screen narrower than 600px max-width), minor side-gutter stays dark on desktop in light mode.

- **Schema/contract changes:** none — `db.js`, `repo.js`, `constants.js` untouched. `exportHtml.js` imports from constants and hours utils read-only.

- **Known issues / TODO:**
    - Light-mode gutter: body background stays dark (#0E0E0F) when light mode toggled, visible only on screens wider than 600px; acceptable for a phone document.
    - `a.download` attribute not honoured by iOS Safari in-browser — file opens instead of downloading; user can long-press → save. Standard limitation, no workaround without a server.

- **Next:** Step 6 — importer to seed library from `Travel_Plans_Yana.xlsx`; or Step 7 Polish.

---

### 2026-06-15 — Step 6: XLSX importer (seed library from Travel_Plans_Yana.xlsx)

- **Done:**
    - `src/utils/xlsxImport.js` (new) — pure `parseXlsxWorkbook(workbook)` function; takes a SheetJS workbook object, returns `{ places, warnings }`. No React, no Dexie. Per-sheet strategies:
        - **Madrid Aug 2024** (`parseMadrid`): structured table — finds header row where col 1 is "Place", extracts name/type/address/day-specific hours. Type strings ("Taproom", "Bar", "Shop") mapped to PLACE_TYPES keys. Hours format: "12:00 PM - 12:00 AM".
        - **Sofia Dec 2025** (`parseSofiaDec`): 2-day table — header row "Venue | Friday | Saturday"; maps English day-name columns to weekday keys; hours format: "10 am–10 pm", "4 pm–1 am".
        - **Bucharest JUN 2024** (`parseHebrewTable`, table only): Hebrew day-name headers in columns (שבת/ראשון/שני = sat/sun/mon); col 0 = venue; hours in day cells; Excel date serials (typeof number) skipped; budget rows (numeric col 0) stop extraction. Grid intentionally skipped (contains Krakow copy-paste content).
        - **Krakow + Warsaw Apr 2024**: `parseHebrewTable` (Krakow table, rows 11+) + `extractGrid` (grid rows 3–9). Grid auto-detects Warsaw columns by scanning all rows 0–9 for "Warsaw"/"Warszawa" keyword; when found, that column and all subsequent become city='Warsaw'. Hours: "13:30-23:30" 24h dash format.
        - **Budapest Feb 2025** (`extractGrid` only): table Place column is blank — fallback to grid cell extraction; emits warning "Budapest: names from grid cells, verify manually".
        - **Katowice + Krakow Mar 2023** (`extractGrid`, multi-city): defaults to Katowice; Krakow detected mid-grid by column keyword scan.
        - **6 grid-only sheets** (`extractGrid`): Krakow Nov 2025, Barcelona Aug 2023, Sofia Jul 2023, Berlin Mar 2023, Sofia Jan 2023, Bucharest Nov 2022.
        - `extractGrid`: rows 3–9 (0-indexed); splits cell values on `\n`; filters Hebrew text, flight/airport codes, digit-leading tokens, transit keywords; strips trailing hours patterns and " - annotation" from names; per-column city propagation.
        - Hours parser (`parseHoursString`): handles em-dash, en-dash, space-hyphen-space, and plain hyphen between two time expressions; both 12h (am/pm) and 24h; Excel date serials (5–6 digit numbers) → null (unknown).
        - Global dedup by `name.toLowerCase()|city.toLowerCase()` across all sheets.
        - Import in `import * as XLSX from 'xlsx'` (named import — ESM default not available).
    - `src/components/XlsxImport.jsx` (new) — 2-step modal: (1) file picker (`.xlsx`, reads via `file.arrayBuffer()` + `XLSX.read(buffer, { type: 'array' })`); (2) preview — total count, breakdown by city (sorted by count), warnings, IMPORT button. On confirm: `getAllPlaces()` builds existing set, skips duplicates by name+city, calls `addPlace()` for each new place. Done state shows imported/skipped counts.
    - `src/components/XlsxImport.css` (new) — `xi-*` namespace, mirrors CsvImport shell visually.
    - `src/App.jsx` — added `import XlsxImport`; `showXlsx` state; `setShowXlsx(false)` in `switchView`; "IMPORT XLSX" button in toolbar; `<XlsxImport>` modal mount.

- **Deviations:**
    - `import * as XLSX` (not `import XLSX`) — ESM build of xlsx has no default export; `import XLSX from 'xlsx'` fails at build time in Vite.
    - Hours imported only for days explicitly listed in the sheet (e.g., sat+sun for Bucharest); all other weekday keys left absent (unknown) per data contract.
    - Name annotation stripping (" - שלישים", " - 0.15") applied globally in `cleanName` — safe for all sheets, no false positives observed.
    - Bucharest JUN 2024 grid skipped entirely (verified: contains Krakow venues from a copy-paste template — importing would create wrong-city records).

- **Schema/contract changes:** none — `db.js`, `repo.js`, `constants.js` untouched.

- **Known issues / TODO:**
    - Grid extraction is heuristic — some non-venue tokens (generic labels, city names used as section headers) may slip through if they don't match the filter patterns. User should review the preview before confirming import.
    - Budapest hours not imported (grid cells have names only, no hours structure). Type defaults to 'other' for all Budapest/grid-extracted venues — edit per-place.
    - Chunk size warning from Vite: xlsx bundle is ~714 kB (gzip ~235 kB). Acceptable for now; dynamic import() of xlsxImport.js is a future optimization if load time becomes an issue.

- **Next:** Step 7 Polish; or extend grid extractor for specific sheets if Budapest/Katowice results look off after a real import test.

---

### 2026-06-15 — Step 7 Commit A: data quality + admin features

- **Done:**
    - `src/utils/hoursParser.js` (new) — pure `parseGoogleHours(text)` → partial `openingHours` object. Handles Format A (alternating day/hours lines, Google Maps desktop copy-paste) and Format B (day: hours per line). Day ranges expand ("Monday–Friday" → mon–fri). `"Closed"` → `null`; `"Open 24 hours"` → `{open:'00:00', close:'24:00'}`; bare-hour tokens ("12") treated as HH:00 to handle "12 – 10 pm". Only sets keys for explicitly mentioned days — absent = unknown per data contract.
    - `src/db/repo.js` — added `clearAllTrips()` (trips + scheduleItems in one `rw` transaction, no orphaned items), `clearAllData()` (all three tables), `exportAll()` (returns `{places, trips, scheduleItems}` arrays), `importAll(data)` (validates `data.places` array guard, then clears + `bulkPut` all tables in one transaction). Removed TEMP comment from `clearAllPlaces`.
    - `src/components/AdminModal.jsx` (new) — `⚙ ADMIN` modal with: Export JSON (download as `trip-planner-backup.json`), Import JSON (file input → `importAll` → error displayed inline if validation fails), Clear Places / Clear Trips / Clear All Data (each with inline REALLY?/CONFIRM/CANCEL row, no `window.confirm`). `onRefresh` prop reloads places + trips in App.
    - `src/components/AdminModal.css` (new) — `admin-*` namespace, matches design language.
    - `src/components/PlaceCard.jsx` — added `incomplete` prop; renders `⚠` in `.card-eyebrow` (right-aligned via flex) when true. Stamp not affected (it's `position:absolute`).
    - `src/components/PlaceCard.css` — `.card-eyebrow` now `display:flex; justify-content:space-between`; `.card-stub` in `--rust`.
    - `src/components/PlaceForm.jsx` — added `parseAddressString` local helper (splits on `,`, strips leading postcode from city segment); address prefill input with auto-parse on paste + PARSE button in LOCATION fieldset. Added `parseGoogleHours` import and hours paste textarea with auto-parse on paste + PARSE button in OPENING HOURS fieldset; merges into existing `hours` state (only overwrites mentioned days).
    - `src/components/PlaceForm.css` — `.prefill-textarea` for the multi-line hours paste input.
    - `src/App.jsx` — `isIncomplete(p)` module-level helper; `filterIncomplete` state + `⚠ INCOMPLETE` toggle button in toolbar (rust-colored when active); `filterIncomplete` AND-ed into `filtered` useMemo; `showAdmin` state + `⚙ ADMIN` button in statusbar; `<AdminModal>` mount; `statusbar-right` wrapper div for admin button + tab switcher; removed temp `⚠ CLEAR PLACES` button and `clearAllPlaces` import.
    - `src/App.css` — `.statusbar-right`, `.btn-admin`, `.btn-import--active` (rust border/text when incomplete filter is on).
- **Deviations:** None from the approved plan.
- **Schema/contract changes:** `repo.js` — four new exports (`clearAllTrips`, `clearAllData`, `exportAll`, `importAll`). No `db.js` or `constants.js` changes.
- **Known issues / TODO:** `PlaceForm` hours editor initialises all 7 days to `null` (closed) rather than absent (unknown) — pre-existing issue, unknown/closed distinction is collapsed in the UI. Deferred.
- **Next:** Step 7 Commit B — theme toggle, compact list view + bulk delete, modal CSS extraction, slot reorder, trip list sort fix, `window.confirm` → inline confirmation for deletes.
