# Session handoff — step 2 complete

## What was done

Step 2 (place library) built and build-verified. The step-1 smoke-test `App.jsx`
has been replaced with the real UI.

---

## Files changed

| File | Action |
|---|---|
| `src/styles.css` | Rewritten — theme tokens, Google Fonts, global reset, scanline |
| `src/main.jsx` | Sets `data-theme="dark"` on `<html>` before mount |
| `src/App.jsx` | Rewritten — Place Library shell (state, filter, modal wiring) |
| `src/App.css` | **New** — statusbar, toolbar, cards-grid layout |
| `src/components/PlaceCard.jsx` | **New** — dossier card with stamp, hours strip |
| `src/components/PlaceCard.css` | **New** |
| `src/components/PlaceForm.jsx` | **New** — add/edit modal + hours editor |
| `src/components/PlaceForm.css` | **New** |

**Untouched:** `src/db/db.js`, `src/db/repo.js`, `src/db/constants.js`,
`src/db/seed.js`, `src/utils/hours.js`. No schema or data-layer changes.

---

## Key decisions

- **Theme attribute on `<html>`** (not `.stage` like the mock). CLAUDE.md says "on
  the root" — `document.documentElement` in `main.jsx`.
- **`system` theme** is pure CSS (`@media prefers-color-scheme` under
  `[data-theme="system"]`). No JS listener needed.
- **Visible theme toggle not yet built** — tokens and attribute are fully wired;
  toggle UI is a small future step.
- **Product name not baked in.** Heading reads `PLACE LIBRARY//`. Statusbar reads
  `FIELD TERMINAL` on the right (descriptor, not a name).
- **In-world labels:** places count in statusbar = "N CACHES". Trips count is
  hardcoded `0` until step 4.
- **Stamps:** `wishlist` → `☆ FLAGGED` (dim) / `planned` → `◐ MARKED` (steel) /
  `visited` → `✓ SECURED` (amber).
- **Delete** is on the card (DEL button → `window.confirm`) — not in the form.
  Keeps the form focused on editing.
- **Client-side filtering** via `useMemo` over `getAllPlaces()` result. One DB
  call on mount + after each mutation; no per-keystroke queries.

---

## Deviations from SPEC / CLAUDE.md

None. All spec features for step 2 are implemented:
list · search · filter by city/type/status · add · edit · delete ·
opening-hours editor · "Open in Google Maps" per card.

---

## Known issues / not-yet-done

- **Trips count in statusbar is `0` (hardcoded).** Real count wires in naturally
  during step 4 when the trips table gets a UI.
- **`window.confirm` for delete** is OS-native, not themed. Good enough for now;
  replace with an inline confirm if it ever feels jarring.
- **Google Fonts via CSS `@import`** — slightly slower than `<link>` in
  `index.html`. Not worth changing until there's a perceived perf issue.
- **Hours "unknown" vs "closed":** a day with no key in `openingHours` renders
  `—` (unknown); only an explicit `null` renders `CLOSED`. This is intentional
  (mirrors the spec's nullable model) but worth knowing when importing data.
- **No empty-hours shortcut in the form.** Each of the 7 days starts closed;
  toggling open initializes to `10:00–22:00`. Users fill in from there.

---

## What's next (step 3)

From SPEC.md / CLAUDE.md build sequence:

> **3. Add-a-place:** paste Google Maps link → best-effort prefill
> (name + coords where the URL exposes them, confirm the rest); CSV import.

Concretely:
- A "paste Maps link" input (or auto-detect on `googleMapsUrl` field paste) that
  attempts to extract name and lat/lng from the URL.
- CSV import: upload a `.csv` → parse with Papaparse → map columns to Place
  fields → bulk-insert via `addPlace` / `putPlace`.
- Both land inside the existing `PlaceForm` flow or as a separate import modal.

Step 4 after that is the Trips grid.
