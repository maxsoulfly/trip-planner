# Worklog

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
    lat, lng, googleMapsUrl. Short-URL warning: *"Short link detected. Open it in
    your browser, then copy the URL from the address bar."* Strip hidden in edit mode.
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
  - `src/components/TripList.jsx` (new) — `TripCard` sub-component: amber corner accent, `TRIP` eyebrow (mono), Space Grotesk title, cities joined with ` · `, date range + day count, outbound/inbound flight summaries if set, OPEN GRID (amber) + EDIT + DEL (ghost) action buttons. `TripList`: `TRIPS//` heading, `+ NEW TRIP` button, empty state `"No trips yet — plan your first expedition."`, 2-col cards grid. Receives all data and handlers as props — fetches nothing itself.
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
