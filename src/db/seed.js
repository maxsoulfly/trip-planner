import { putPlace, putTrip, putScheduleItem, resetAll } from './repo.js';

// ---------------------------------------------------------------------------
// Dummy data for the step-1 round-trip test. Uses real-flavoured entries from
// the original sheet (Kraków Nov 2025) so what you see on screen is legible.
//
// Stable string ids ('p-swiat', 't-krk-nov25', ...) make seeding idempotent:
// re-running upserts the same records instead of duplicating them.
// ---------------------------------------------------------------------------

const PLACES = [
  {
    id: 'p-swiat',
    name: 'Świat Piwa',
    type: 'bottle_shop',
    city: 'Kraków',
    country: 'Poland',
    lat: 50.0566,
    lng: 19.9389,
    address: 'Sarego 22, Kraków',
    googleMapsUrl: 'https://maps.google.com/?q=Swiat+Piwa+Krakow',
    untappdUrl: '',
    openingHours: {
      mon: { open: '10:00', close: '22:00' },
      tue: { open: '10:00', close: '22:00' },
      wed: { open: '10:00', close: '22:00' },
      thu: { open: '10:00', close: '23:00' },
      fri: { open: '10:00', close: '00:00' },
      sat: { open: '10:00', close: '00:00' },
      sun: { open: '12:00', close: '22:00' },
    },
    tags: ['craft', 'bottle-shop'],
    notes: 'Reliable opener — good first stop.',
    status: 'visited',
    rating: 4,
  },
  {
    id: 'p-multiqlti',
    name: 'Multi Qlti',
    type: 'taproom',
    city: 'Kraków',
    country: 'Poland',
    lat: 50.0614,
    lng: 19.938,
    address: "Sławkowska, Kraków",
    googleMapsUrl: 'https://maps.google.com/?q=Multi+Qlti+Krakow',
    untappdUrl: '',
    openingHours: {
      mon: null,
      tue: { open: '16:00', close: '00:00' },
      wed: { open: '16:00', close: '00:00' },
      thu: { open: '16:00', close: '00:00' },
      fri: { open: '14:00', close: '02:00' },
      sat: { open: '14:00', close: '02:00' },
      sun: { open: '14:00', close: '00:00' },
    },
    tags: ['craft', 'taproom'],
    notes: '',
    status: 'planned',
    rating: null,
  },
  {
    id: 'p-schindler',
    name: "Schindler's Factory Museum",
    type: 'museum',
    city: 'Kraków',
    country: 'Poland',
    lat: 50.0476,
    lng: 19.9617,
    address: 'Lipowa 4, Kraków',
    googleMapsUrl: 'https://maps.google.com/?q=Schindler+Factory+Museum',
    untappdUrl: '',
    openingHours: {
      mon: { open: '10:00', close: '16:00' },
      tue: { open: '09:00', close: '17:00' },
      wed: { open: '09:00', close: '17:00' },
      thu: { open: '09:00', close: '17:00' },
      fri: { open: '09:00', close: '17:00' },
      sat: { open: '09:00', close: '17:00' },
      sun: { open: '09:00', close: '17:00' },
    },
    tags: ['culture'],
    notes: 'Book ahead.',
    status: 'planned',
    rating: null,
  },
  {
    id: 'p-shalom',
    name: 'Shalom Kazimierz (apartment)',
    type: 'accommodation',
    city: 'Kraków',
    country: 'Poland',
    lat: 50.0515,
    lng: 19.9446,
    address: 'Kazimierz district, Kraków',
    googleMapsUrl: 'https://maps.google.com/?q=Kazimierz+Krakow',
    untappdUrl: '',
    openingHours: {},
    tags: ['stay'],
    notes: 'Check-in from 15:00.',
    status: 'planned',
    rating: null,
  },
  {
    // A different city — proves the library is global, not per-trip.
    id: 'p-100beers',
    name: '100 Beers',
    type: 'taproom',
    city: 'Sofia',
    country: 'Bulgaria',
    lat: 42.6977,
    lng: 23.3219,
    address: 'Sofia center',
    googleMapsUrl: 'https://maps.google.com/?q=100+Beers+Sofia',
    untappdUrl: '',
    openingHours: {
      mon: { open: '10:00', close: '22:00' },
      tue: { open: '10:00', close: '22:00' },
      wed: { open: '10:00', close: '22:00' },
      thu: { open: '10:00', close: '22:00' },
      fri: { open: '10:00', close: '22:00' },
      sat: { open: '10:00', close: '20:00' },
      sun: { open: '10:00', close: '20:00' },
    },
    tags: ['craft', 'taproom'],
    notes: 'Big tap list.',
    status: 'visited',
    rating: 5,
  },
];

const TRIP = {
  id: 't-krk-nov25',
  title: 'Kraków Nov 2025',
  cities: ['Kraków'],
  startDate: '2025-11-16',
  endDate: '2025-11-19',
  outboundFlight: {
    airline: 'Wizz Air',
    number: 'W6 2098',
    from: 'TLV',
    to: 'KRK',
    depTime: '2025-11-16T11:00',
    arrTime: '2025-11-16T14:55',
  },
  inboundFlight: {
    airline: 'Wizz Air',
    number: 'W6 2097',
    from: 'KRK',
    to: 'TLV',
    depTime: '2025-11-19T06:30',
    arrTime: '2025-11-19T10:05',
  },
  accommodationPlaceIds: ['p-shalom'],
  notes: 'Seed trip for the round-trip test.',
};

const SCHEDULE = [
  // Day 1 — arrival
  {
    id: 's1', tripId: 't-krk-nov25', date: '2025-11-16', block: 'morning', order: 0,
    kind: 'flight', placeId: null,
    adHoc: { label: '✈ TLV 11:00 → KRK 14:55 · Wizz W6 2098' }, notes: '',
  },
  {
    id: 's2', tripId: 't-krk-nov25', date: '2025-11-16', block: 'evening', order: 0,
    kind: 'place', placeId: 'p-swiat', adHoc: null, notes: 'First stop.',
  },
  {
    id: 's3', tripId: 't-krk-nov25', date: '2025-11-16', block: 'night', order: 0,
    kind: 'place', placeId: 'p-shalom', adHoc: null, notes: '',
  },
  // Day 2
  {
    id: 's4', tripId: 't-krk-nov25', date: '2025-11-17', block: 'morning', order: 0,
    kind: 'place', placeId: 'p-schindler', adHoc: null, notes: '',
  },
  {
    id: 's5', tripId: 't-krk-nov25', date: '2025-11-17', block: 'late_afternoon', order: 0,
    kind: 'place', placeId: 'p-multiqlti', adHoc: null, notes: '',
  },
  {
    id: 's6', tripId: 't-krk-nov25', date: '2025-11-17', block: 'night', order: 0,
    kind: 'place', placeId: 'p-shalom', adHoc: null, notes: '',
  },
];

// Wipes existing data and writes the dummy set. Returns nothing; the UI
// re-reads from the db afterwards (that read-back is the actual test).
export async function seedDummyData() {
  await resetAll();
  for (const p of PLACES) await putPlace(p);
  await putTrip(TRIP);
  for (const s of SCHEDULE) await putScheduleItem(s);
}
