import Dexie from 'dexie';

// ---------------------------------------------------------------------------
// IndexedDB via Dexie. Local-first: everything lives in the browser.
//
// The schema strings below only list the PRIMARY KEY + the fields we want to
// be INDEXED (i.e. searchable/filterable). Every other field on an object is
// still stored — it just isn't indexed. The full shape of each record is
// documented in the comments so the model is readable here, not just in SPEC.
//
// Primary key is a string `id` (we generate UUIDs ourselves), so it is NOT
// auto-incrementing — that's why `id` has no `++` prefix.
// ---------------------------------------------------------------------------

export const db = new Dexie('trip-planner');

db.version(1).stores({
  places: 'id, name, type, city, country, status',
  trips: 'id, title, startDate',
  scheduleItems: 'id, tripId, [tripId+date], placeId',
});

// version(2) — adds websiteUrl to places (non-breaking; existing records get undefined).
db.version(2).stores({
  places: 'id, name, type, city, country, status',
  trips: 'id, title, startDate',
  scheduleItems: 'id, tripId, [tripId+date], placeId',
});

// version(3) — adds checkIn, checkOut to places (non-indexed time fields).
// No migration needed — new fields default to undefined on existing records.
db.version(3).stores({
  // PLACE — stored once, globally. "A city's places" is just a filter on city.
  //   {
  //     id, name, type, city, country,
  //     lat, lng,                 // nullable, from Maps-link parse or manual
  //     address, googleMapsUrl, untappdUrl, websiteUrl,
  //     openingHours,             // { mon: {open,close}|null, ... sun }
  //     checkIn, checkOut,        // 'HH:MM' strings; accommodation only; '' = not set
  //     tags: [],
  //     notes,
  //     status,                   // 'wishlist' | 'planned' | 'visited'
  //     rating,                   // nullable number
  //     createdAt, updatedAt
  //   }
  places: 'id, name, type, city, country, status, createdAt',

  // TRIP — a curated selection of places + a date range + flights.
  //   {
  //     id, title, cities: [],
  //     startDate, endDate,       // ISO date strings 'YYYY-MM-DD'
  //     outboundFlight,           // { airline, number, from, to, depTime, arrTime } | null
  //     inboundFlight,            // same shape | null
  //     accommodationPlaceIds: [],// references Place ids of type accommodation
  //     notes,
  //     createdAt, updatedAt
  //   }
  trips: 'id, title, startDate',

  // SCHEDULEITEM — links a place (or an ad-hoc item) into one grid slot.
  //   {
  //     id, tripId,
  //     date,                     // 'YYYY-MM-DD'
  //     block,                    // 'morning' | 'noon' | 'late_afternoon' | 'evening' | 'night'
  //     order,                    // sort order within the slot
  //     kind,                     // 'place' | 'flight' | 'transport' | 'note'
  //     placeId,                  // set when kind === 'place'
  //     adHoc,                    // { label, ... } when kind !== 'place'
  //     notes
  //   }
  // The compound [tripId+date] index makes "give me this trip's day" fast.
  scheduleItems: 'id, tripId, [tripId+date], placeId',
});

// version(4) — adds state field to places index.
// No migration needed — state defaults to undefined/'' on existing records.
db.version(4).stores({
  // PLACE shape (additions from v3):
  //   state,  // optional state/region string, e.g. 'OR', 'BC'
  places:        'id, name, type, city, state, country, status, createdAt',
  trips:         'id, title, startDate',
  scheduleItems: 'id, tripId, [tripId+date], placeId',
});

// version(5) — moves PLACE_TYPES / VENUE_TRAITS from compile-time constants
// into IndexedDB so labels/emoji/keywords can be edited in the UI. Keys are
// permanent (never editable) — Place.type and tags keep referencing the same
// key strings, so no place record migration is ever needed.
db.version(5).stores({
  places:        'id, name, type, city, state, country, status, createdAt',
  trips:         'id, title, startDate',
  scheduleItems: 'id, tripId, [tripId+date], placeId',
  // PLACETYPE — { key, label, emoji, order, keywords: [] }. key is PK, immutable.
  // order indexed — getAllPlaceTypes() sorts by it via orderBy('order').
  placeTypes:    'key, order',
  // VENUETRAIT — { key, label, emoji, order, hintKeywords: [] }. key is PK, immutable.
  venueTraits:   'key, order',
}).upgrade(() => {
  // Tables are empty on upgrade — seeded by seedTypesAndTraits() on app mount.
});

export default db;
