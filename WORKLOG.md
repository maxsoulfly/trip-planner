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
