import db from './db.js';

// ---------------------------------------------------------------------------
// Repository layer: the only module that talks to Dexie directly. UI calls
// these functions instead of touching `db`, so storage details stay in one
// place (and a future sync layer can wrap these without rewriting the UI).
// Everything is async (Dexie returns promises).
// ---------------------------------------------------------------------------

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ----- Place types / venue traits (editable vocabulary, db.js v5) ----------
// Seed data — copied from the old constants.js PLACE_TYPES/VENUE_TRAITS arrays,
// consolidated with keyword lists that used to live separately in
// PlaceForm.jsx (TYPE_KEYWORDS) and blobParser.js (TRAIT_HINTS). Only used to
// populate the DB on first run — after that, the DB is the source of truth.

const PLACE_TYPES_SEED = [
  { key: 'taproom',       label: 'Taproom',       emoji: '🍺', order: 0,
    keywords: ['taproom','tap room','beer bar','craft beer','beer'] },
  { key: 'bottle_shop',   label: 'Bottle Shop',   emoji: '🛍', order: 1,
    keywords: ['beer shop','bottle shop','beer store','beerstore'] },
  { key: 'brewpub',       label: 'Brewpub',       emoji: '🍻', order: 2,
    keywords: ['brewpub','brew pub','beer & food','beer and food','brewing'] },
  { key: 'brewery',       label: 'Brewery',       emoji: '🏭', order: 3,
    keywords: ['brewery','browar','brauerei','pivovar'] },
  { key: 'bar',           label: 'Bar',           emoji: '🏆', order: 4,
    keywords: ['bar'] },
  { key: 'restaurant',    label: 'Restaurant',    emoji: '🍽', order: 5,
    keywords: ['restaurant','bistro','brasserie','ristorante','sushi','ramen',
               'poke','pizza','pizzeria','burger','falafel','gyros','grill'] },
  { key: 'cafe',          label: 'Café',          emoji: '☕', order: 6,
    keywords: ['café','cafe','coffee','kawiarnia','kaffee','specialty coffee'] },
  { key: 'museum',        label: 'Museum',        emoji: '🏛', order: 7,
    keywords: ['museum','muzeum','muzej','gallery','galeria','galeri'] },
  { key: 'park',          label: 'Park / Cemetery', emoji: '🌳', order: 8,
    keywords: ['park','cemetery','cmentarz','hřbitov','garden','jardín','zoo','botanical'] },
  { key: 'activity',      label: 'Activity',      emoji: '🎯', order: 9,  keywords: [] },
  { key: 'shop',          label: 'Shop',          emoji: '🏪', order: 10, keywords: [] },
  { key: 'supermarket',   label: 'Supermarket',   emoji: '🛒', order: 11, keywords: [] },
  { key: 'accommodation', label: 'Accommodation', emoji: '🏠', order: 12,
    keywords: ['hotel','hostel','noclegi','apartment','apartament','pension','inn'] },
  { key: 'transport',     label: 'Transport',     emoji: '🚌', order: 13, keywords: [] },
  { key: 'other',         label: 'Other',         emoji: '📍', order: 14, keywords: [] },
];

const VENUE_TRAITS_SEED = [
  { key: 'craft-beer',    label: 'Craft Beer',   emoji: '🍺', order: 0,
    hintKeywords: ['craft beer','taproom','brewery','brewpub','bottle shop'] },
  { key: 'taps-on-site',  label: 'Taps On-Site', emoji: '🚰', order: 1,
    hintKeywords: ['taproom','taps','draft'] },
  { key: 'bottles-to-go', label: 'Bottles To-Go',emoji: '🛍', order: 2,
    hintKeywords: ['bottle shop','bottle store','to go','take away'] },
  { key: 'food',          label: 'Food',         emoji: '🍽', order: 3,
    hintKeywords: ['restaurant','bistro','sushi','ramen','poke','pizza','burger',
                   'falafel','gyros','grill','tavern','food','kitchen'] },
  { key: 'wine',          label: 'Wine',         emoji: '🍷', order: 4,
    hintKeywords: ['wine','winery','vino'] },
  { key: 'cocktails',     label: 'Cocktails',    emoji: '🍸', order: 5,
    hintKeywords: ['cocktail','cocktails','mixology'] },
  { key: 'coffee',        label: 'Coffee',       emoji: '☕', order: 6,
    hintKeywords: ['coffee','café','cafe','specialty coffee','espresso'] },
  { key: 'outdoor',       label: 'Outdoor',      emoji: '🌿', order: 7,
    hintKeywords: ['outdoor','garden','terrace','rooftop'] },
  { key: 'happy-hours',   label: 'Happy Hours',  emoji: '🍻', order: 8,
    hintKeywords: ['happy hour','happy hours'] },
];

// Seeds both tables on first run only — safe to call on every app mount.
export async function seedTypesAndTraits() {
  const [typeCount, traitCount] = await Promise.all([
    db.placeTypes.count(),
    db.venueTraits.count(),
  ]);
  if (typeCount === 0) await db.placeTypes.bulkPut(PLACE_TYPES_SEED);
  if (traitCount === 0) await db.venueTraits.bulkPut(VENUE_TRAITS_SEED);
}

export const getAllPlaceTypes  = () => db.placeTypes.orderBy('order').toArray();
export const getAllVenueTraits = () => db.venueTraits.orderBy('order').toArray();

export async function putPlaceType(type)  { return db.placeTypes.put(type); }
export async function putVenueTrait(trait){ return db.venueTraits.put(trait); }

export async function deletePlaceType(key) {
  const count = await db.places.where('type').equals(key).count();
  if (count > 0) throw new Error(`Cannot delete: ${count} places use type "${key}"`);
  return db.placeTypes.delete(key);
}
export async function deleteVenueTrait(key) {
  // Traits live inside the free-form tags array on each place, not an indexed
  // field — no cheap count query. Deletion is allowed unconditionally; any
  // place still carrying the tag string just keeps an orphaned tag.
  return db.venueTraits.delete(key);
}

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

// Set country on every place in a city — used by CitiesModal to fix mixed-country rows.
export async function setCountryForCity(city, country) {
  const places = await db.places.where('city').equals(city).toArray();
  await Promise.all(places.map(p => db.places.put({ ...p, country, updatedAt: now() })));
  return places.length;
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
