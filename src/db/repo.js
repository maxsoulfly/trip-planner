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
    country: '',
    lat: null,
    lng: null,
    address: '',
    googleMapsUrl: '',
    untappdUrl: '',
    openingHours: {},
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
