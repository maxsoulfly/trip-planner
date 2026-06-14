# Trip Planner

Local-first, beer-first (but general) trip planner for Maxx & Yana.
Plain JavaScript + React (Vite). Data lives in the browser (IndexedDB via Dexie).

See `SPEC.md` for the full v1 plan and roadmap.

## Stack

- **Vite + React** (plain JS / JSX — no TypeScript)
- **Dexie** — IndexedDB wrapper
- Standard CSS, React Context for state (no Redux)

## Run it

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173`.

## Step 1 — what to verify

This is the data-layer round-trip test. Confirm:

1. The page loads and says **"empty"**.
2. Click **Seed dummy data** → places, the Kraków trip (with flights), and a
   schedule appear, with schedule items showing the correct place names.
3. **Reload the browser tab.** The data is still there → IndexedDB
   persistence works (it's not just React state).
4. Click **Clear all** → everything wipes back to empty.

If all four hold, the data layer is solid and we move to step 2 (the real
place-library UI).

## Project layout

```
src/
  main.jsx            React entry
  App.jsx             Step-1 smoke-test screen (throwaway)
  styles.css          Minimal styling (real design at step 2)
  db/
    db.js             Dexie instance + schema (the data model)
    constants.js      Place types, time blocks, statuses, weekdays
    repo.js           CRUD layer — the only code that touches Dexie
    seed.js           Dummy data (real-flavoured, from the sheet)
  utils/
    hours.js          Opening-hours helpers
```

## Git

```bash
git init
git add -A
git commit -m "Step 1: Vite+React scaffold, Dexie schema, dummy-data round-trip"
```
