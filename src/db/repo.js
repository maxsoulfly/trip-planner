import db from './db.js';

// ---------------------------------------------------------------------------
// Repository layer: the only module that talks to Dexie directly. UI calls
// these functions instead of touching `db`, so storage details stay in one
// place (and a future sync layer can wrap these without rewriting the UI).
// Everything is async (Dexie returns promises).
// ---------------------------------------------------------------------------

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ----- Places --------------------------------------------------------------

export async function addPlace(data) {
  const place = {
    id: uuid(),
    name: '',
    type: 'other',
    city: '',
    state: '',
    country: '',
    lat: null,
    lng: null,
    address: '',
    googleMapsUrl: '',
    untappdUrl: '',
    websiteUrl: '',
    openingHours: {},
    checkIn: '',
    checkOut: '',
    tags: [],
    notes: '',
    status: 'wishlist',
    rating: null,
    ...data,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.places.add(place);
  return place;
}

// Upsert (used by the seeder so it can run repeatedly without duplicating).
export async function putPlace(place) {
  await db.places.put({ ...place, updatedAt: now() });
  return place;
}

export const getPlace = (id) => db.places.get(id);
export const getAllPlaces = () => db.places.orderBy('name').toArray();
export const getPlacesByCity = (city) => db.places.where('city').equals(city).toArray();
export const deletePlace = (id) => db.places.delete(id);
export const clearAllPlaces = () => db.places.clear();

// Reassign all places from sourceCity to targetCity.
export async function mergeCities(sourceCity, targetCity) {
  const places = await db.places.where('city').equals(sourceCity).toArray();
  await Promise.all(places.map((p) => db.places.put({ ...p, city: targetCity, updatedAt: now() })));
}

// Merge two place records in one atomic transaction.
// Primary wins on all identity fields; weaker-signal fields fall back to duplicate.
// All scheduleItems pointing at the duplicate are reassigned to the primary.
// Returns { merged, scheduleItemsUpdated }.
export async function mergePlaces(primaryId, duplicateId) {
  let merged;
  let scheduleItemsUpdated = 0;

  await db.transaction('rw', db.places, db.scheduleItems, async () => {
    const [primary, duplicate] = await Promise.all([
      db.places.get(primaryId),
      db.places.get(duplicateId),
    ]);
    if (!primary)   throw new Error(`Primary place ${primaryId} not found`);
    if (!duplicate) throw new Error(`Duplicate place ${duplicateId} not found`);

    // openingHours: start from primary; fill absent weekday keys from duplicate
    const primaryHours = primary.openingHours || {};
    const dupHours     = duplicate.openingHours || {};
    const mergedHours  = { ...primaryHours };
    for (const key of Object.keys(dupHours)) {
      if (!(key in primaryHours)) mergedHours[key] = dupHours[key];
    }

    // tags: union, lowercased, deduped
    const mergedTags = [
      ...new Set(
        [...(primary.tags || []), ...(duplicate.tags || [])].map((t) => t.toLowerCase())
      ),
    ];

    // notes: concatenate with ' | ' when both non-empty
    const pNotes = (primary.notes   || '').trim();
    const dNotes = (duplicate.notes || '').trim();
    const mergedNotes = pNotes && dNotes ? `${pNotes} | ${dNotes}` : (pNotes || dNotes);

    merged = {
      ...primary,
      // Truthy-fallback fields: primary wins if it has a value
      address:       primary.address       || duplicate.address       || '',
      googleMapsUrl: primary.googleMapsUrl || duplicate.googleMapsUrl || '',
      untappdUrl:    primary.untappdUrl    || duplicate.untappdUrl    || '',
      websiteUrl:    primary.websiteUrl    || duplicate.websiteUrl    || '',
      lat:           primary.lat  != null  ? primary.lat  : duplicate.lat,
      lng:           primary.lng  != null  ? primary.lng  : duplicate.lng,
      // Merged fields
      openingHours:  mergedHours,
      tags:          mergedTags,
      notes:         mergedNotes,
      // Keep primary's unless it has no signal, then take duplicate's
      rating: primary.rating != null ? primary.rating : duplicate.rating,
      type:   primary.type !== 'other'  ? primary.type  : duplicate.type,
      updatedAt: now(),
    };

    // Reassign schedule items pointing at the duplicate
    const items = await db.scheduleItems.where('placeId').equals(duplicateId).toArray();
    scheduleItemsUpdated = items.length;
    if (items.length > 0) {
      await Promise.all(items.map((item) => db.scheduleItems.put({ ...item, placeId: primaryId })));
    }

    await db.places.put(merged);
    await db.places.delete(duplicateId);
  });

  return { merged, scheduleItemsUpdated };
}

// Count how many schedule items reference a given place (for merge preview).
export const countScheduleItemsByPlace = (placeId) =>
  db.scheduleItems.where('placeId').equals(placeId).count();

// Wipe trips and all their schedule items together — no orphaned items.
export async function clearAllTrips() {
  await db.transaction('rw', db.trips, db.scheduleItems, async () => {
    await Promise.all([db.trips.clear(), db.scheduleItems.clear()]);
  });
}

// Wipe every table.
export async function clearAllData() {
  await db.transaction('rw', db.places, db.trips, db.scheduleItems, async () => {
    await Promise.all([db.places.clear(), db.trips.clear(), db.scheduleItems.clear()]);
  });
}

// Snapshot all data for JSON backup.
export async function exportAll() {
  const [places, trips, scheduleItems] = await Promise.all([
    db.places.toArray(),
    db.trips.toArray(),
    db.scheduleItems.toArray(),
  ]);
  return { places, trips, scheduleItems };
}

// Restore from backup object. Validates, then replaces all data atomically.
export async function importAll(data) {
  if (!data?.places || !Array.isArray(data.places))
    throw new Error('Invalid backup file — missing places array');
  await db.transaction('rw', db.places, db.trips, db.scheduleItems, async () => {
    await Promise.all([db.places.clear(), db.trips.clear(), db.scheduleItems.clear()]);
    if (data.places.length)             await db.places.bulkPut(data.places);
    if (data.trips?.length)             await db.trips.bulkPut(data.trips);
    if (data.scheduleItems?.length)     await db.scheduleItems.bulkPut(data.scheduleItems);
  });
}

// ----- Trips ---------------------------------------------------------------

export async function addTrip(data) {
  const trip = {
    id: uuid(),
    title: '',
    cities: [],
    startDate: '',
    endDate: '',
    outboundFlight: null,
    inboundFlight: null,
    accommodationPlaceIds: [],
    notes: '',
    ...data,
    createdAt: now(),
    updatedAt: now(),
  };
  await db.trips.add(trip);
  return trip;
}

export async function putTrip(trip) {
  await db.trips.put({ ...trip, updatedAt: now() });
  return trip;
}

export const getTrip = (id) => db.trips.get(id);
export const getAllTrips = () => db.trips.orderBy('startDate').toArray();
export const deleteTrip = (id) => db.trips.delete(id);

// Delete a trip and all its schedule items in one transaction.
export async function deleteTripCascade(tripId) {
  await db.transaction('rw', db.trips, db.scheduleItems, async () => {
    await db.scheduleItems.where('tripId').equals(tripId).delete();
    await db.trips.delete(tripId);
  });
}

// ----- Schedule items ------------------------------------------------------

export async function addScheduleItem(data) {
  const item = {
    id: uuid(),
    tripId: '',
    date: '',
    block: 'morning',
    order: 0,
    kind: 'place',
    placeId: null,
    adHoc: null,
    notes: '',
    ...data,
  };
  await db.scheduleItems.add(item);
  return item;
}

export async function putScheduleItem(item) {
  await db.scheduleItems.put(item);
  return item;
}

export const getScheduleForTrip = (tripId) =>
  db.scheduleItems.where('tripId').equals(tripId).toArray();

export const deleteScheduleItem = (id) => db.scheduleItems.delete(id);

export const deleteScheduleItemsByTrip = (tripId) =>
  db.scheduleItems.where('tripId').equals(tripId).delete();

// ----- Whole-db helpers (handy during development) -------------------------

export async function resetAll() {
  await db.transaction('rw', db.places, db.trips, db.scheduleItems, async () => {
    await Promise.all([db.places.clear(), db.trips.clear(), db.scheduleItems.clear()]);
  });
}

export async function counts() {
  const [places, trips, scheduleItems] = await Promise.all([
    db.places.count(),
    db.trips.count(),
    db.scheduleItems.count(),
  ]);
  return { places, trips, scheduleItems };
}
