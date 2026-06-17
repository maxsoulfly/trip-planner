// ---------------------------------------------------------------------------
// Controlled vocabularies. These are the "enums" the whole app references.
// Keeping them here means the library UI, the grid, and the importer all
// agree on the same set of types/blocks/statuses.
// ---------------------------------------------------------------------------

// Place types. Beer types are first-class (taproom / bottle_shop / brewpub /
// bar), then the general categories. `emoji` mirrors the taxonomy from the
// original Google Sheet so imported data feels familiar.
export const PLACE_TYPES = [
  { key: 'taproom',       label: 'Taproom',       emoji: '🍺' },
  { key: 'bottle_shop',   label: 'Bottle shop',   emoji: '🛍️' },
  { key: 'brewpub',       label: 'Brewpub',       emoji: '🍻' },
  { key: 'bar',           label: 'Bar',           emoji: '🍸' },
  { key: 'restaurant',    label: 'Restaurant',    emoji: '🍽' },
  { key: 'cafe',          label: 'Café',          emoji: '☕' },
  { key: 'museum',        label: 'Museum',        emoji: '🏛️' },
  { key: 'activity',      label: 'Activity',      emoji: '⛳' },
  { key: 'shop',          label: 'Shop',          emoji: '🏪' },
  { key: 'supermarket',   label: 'Supermarket',   emoji: '🛒' },
  { key: 'accommodation', label: 'Accommodation', emoji: '🏠' },
  { key: 'transport',     label: 'Transport',     emoji: '🚆' },
  { key: 'other',         label: 'Other',         emoji: '📍' },
];

// Time-of-day blocks — Maxx's existing model from the sheet (kept on purpose).
// `order` controls top-to-bottom position in the day grid.
export const BLOCKS = [
  { key: 'morning',        label: 'Morning',        emoji: '🌄', order: 0 },
  { key: 'noon',           label: 'Noon',           emoji: '🕛', order: 1 },
  { key: 'late_afternoon', label: 'Late afternoon', emoji: '⛅', order: 2 },
  { key: 'evening',        label: 'Evening',        emoji: '🌆', order: 3 },
  { key: 'night',          label: 'Night stay',     emoji: '🌃', order: 4 },
];

// Where a place sits in your pipeline.
export const STATUSES = [
  { key: 'wishlist',           label: 'Wishlist',           emoji: '☆' },
  { key: 'planned',            label: 'Planned',            emoji: '◐' },
  { key: 'visited',            label: 'Visited',            emoji: '✓' },
  { key: 'permanently_closed', label: 'Permanently closed', emoji: '✕' },
];

// Weekday keys used by Place.openingHours. Monday-first to match Europe.
export const WEEKDAYS = [
  { key: 'mon', label: 'Mon' },
  { key: 'tue', label: 'Tue' },
  { key: 'wed', label: 'Wed' },
  { key: 'thu', label: 'Thu' },
  { key: 'fri', label: 'Fri' },
  { key: 'sat', label: 'Sat' },
  { key: 'sun', label: 'Sun' },
];

// --- Small lookup helpers (so UI code can do typeMeta('taproom').emoji) ---

const byKey = (list) => Object.fromEntries(list.map((x) => [x.key, x]));

const PLACE_TYPE_MAP = byKey(PLACE_TYPES);
const BLOCK_MAP = byKey(BLOCKS);
const STATUS_MAP = byKey(STATUSES);

export const typeMeta = (key) => PLACE_TYPE_MAP[key] || PLACE_TYPE_MAP.other;
export const blockMeta = (key) => BLOCK_MAP[key];
export const statusMeta = (key) => STATUS_MAP[key] || STATUS_MAP.wishlist;
