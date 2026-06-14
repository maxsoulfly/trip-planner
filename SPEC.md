# Trip Planner — v1 Spec

A local-first, **beer-first (but general)** trip planner for Maxx & Yana,
built around a *place* as the core object. Standalone React/Vite app.

---

## Core principle

The unit is not the *trip* — it's the **place**. Trips are a curated
selection of library places, scheduled into a day grid. Everything
(hours, flights, accommodation, future budget, future auto-suggest)
hangs off places.

---

## Users & platform

- **Two users:** Maxx & Yana. No logins in v1.
- **Local-first:** all data in the browser (IndexedDB). No backend.
- **Day-of-trip, on the phone:** handled by **HTML day-sheet export**
  (offline, tap-to-Maps), *not* by mobile sync. Sheets/xlsx export is a
  parked fallback if HTML doesn't fit in real use.
- Schema is clean + serializable so a sync layer (for Yana) can be
  added later without a rewrite.

---

## Code constraints (hard)

Written in a language Maxx can read and maintain:

- **Plain JavaScript — no TypeScript.** JS + JSX.
- **Standard CSS** (or CSS Modules: scoped, readable, no build magic).
  Not Tailwind unless explicitly chosen later.
- **React via Vite.**
- Minimal, well-commented, few dependencies.
- Simple state via **React Context** — no Redux.

**Dependencies:** Dexie (IndexedDB), Papaparse (CSV), SheetJS (importer
+ optional future xlsx export). That's it for v1.

---

## Data model

### Place  *(stored once, globally; "a city's places" = a filter)*
- `id`
- `name`
- `type` — beer types first-class: `taproom`, `bottle_shop`, `brewpub`,
  `bar`; plus `restaurant`, `cafe`, `museum`, `activity`, `shop`,
  `accommodation`, `transport`, `other`
- `city`, `country`
- `lat`, `lng` *(nullable — from Maps-link parse or manual)*
- `address`
- `googleMapsUrl`
- `untappdUrl` *(nullable)*
- `openingHours` — keyed by weekday, each `{ open, close }` in `HH:MM`
  or `null` (closed). First-class, always visible.
- `tags` *(array)*
- `notes`
- `status` — `wishlist` | `planned` | `visited`
- `rating` *(nullable)*
- `createdAt`, `updatedAt`

### Trip
- `id`
- `title`
- `cities` *(array — supports Kraków + Warsaw style trips)*
- `startDate`, `endDate`
- `outboundFlight` / `inboundFlight` — `{ airline, number, from, to,
  depTime, arrTime }` *(from the `TLV 09:15 SOF 12:05 Wizz 4428`
  pattern; auto-dropped as ✈ into first/last slots)*
- `accommodation` — references Place(s) of type `accommodation`
  (address + Maps link), assigned to night-stay slots
- `notes`
- `createdAt`, `updatedAt`

### ScheduleItem  *(links a place into the grid)*
- `id`, `tripId`
- `date`
- `block` — `morning` | `noon` | `late_afternoon` | `evening` | `night`
  *(Maxx's existing time-of-day model, kept)*
- `order` *(within a block)*
- `kind` — `place` | `flight` | `transport` | `note`
- `placeId` *(when kind = place)*
- `adHoc` *(label etc. for flight/transport/note)*
- `notes`

### BudgetEntry  *(DEFERRED — schema reserved)*
- `id`, `tripId`, `amount`, `currency`, `payer`/`card`, `category`,
  `splitNote`, `date`

---

## In scope for v1

1. **Place library** — search + filter by city / type / status;
   add / edit / delete. Hours always visible. "Open in Google Maps"
   per place.
2. **Add a place** — manual form; paste Google Maps link → best-effort
   prefill (name + coords where the URL exposes them, you confirm the
   rest); CSV import.
3. **Importer** — seed the library from the existing 12-trip
   `Travel_Plans_Yana.xlsx`. Best-effort: venue tables parse cleanly;
   emoji-grid cells extracted as far as reasonable, then hand-cleaned.
4. **Trips** — pick cities + date range → day columns generate →
   assign places into time-blocks; add flights, accommodation
   (address + map), ad-hoc items.
5. **HTML day-sheet export** — one offline `.html` per trip. Each place
   shows **that day's hours** + a big **tap → Open in Google Maps**.
   This is the phone deliverable.

---

## Deferred — roadmap (rough priority)

1. **Auto-suggest a plan** from saved places, constrained by opening
   hours. Heuristic, human-in-the-loop ("draft you then drag to
   adjust"). Uses hours + type + coords — **already supported by the v1
   schema, no rework.** Quality scales with how completely hours/coords
   are filled in.
2. **In-app Leaflet/OSM overview map** — read-only pin cluster by type,
   for crawl planning. No navigation (Google Maps owns that). ~quick.
3. **Budget / split tracking** (BudgetEntry).
4. **Real API auto-fill** (Google Places / Untappd) — needs keys.
5. **Sync with Yana** (backend — Supabase, or CRDT for two-way edit).
6. **Sheets/xlsx export** — fallback if HTML isn't enough day-of.

---

## Build sequence  *(discuss → implement → test → commit at each step)*

1. Vite + React (JS) scaffold; schema; IndexedDB via Dexie; dummy data
   round-trip. **Commit.**
2. Place library — list / filter / search, add / edit / delete, hours
   field, Open-in-Maps. **Commit.**
3. Maps-link prefill + CSV import. **Commit.**
4. Trips — day × time-block grid, assign places, flights, accommodation
   (address + map), ad-hoc items. **Commit.**
5. HTML day-sheet export. **Commit.** ← phone deliverable
6. Importer → seed the real 12-trip library. **Commit.**
7. Polish, then pick the first fast-follow (likely auto-suggest).
