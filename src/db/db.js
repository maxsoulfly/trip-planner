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
  // PLACE — stored once, globally. "A city's places" is just a filter on city.
  //   {
  //     id, name, type, city, country,
  //     lat, lng,                 // nullable, from Maps-link parse or manual
  //     address, googleMapsUrl, untappdUrl,
  //     openingHours,             // { mon: {open,close}|null, ... sun }
  //     tags: [],
  //     notes,
  //     status,                   // 'wishlist' | 'planned' | 'visited'
  //     rating,                   // nullable number
  //     createdAt, updatedAt
  //   }
  places: 'id, name, type, city, country, status',

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

  // BUDGETENTRY is DEFERRED (see SPEC). Table intentionally not created yet;
  // it will be added in a later db.version(2) so existing data migrates safely.
});

export default db;
