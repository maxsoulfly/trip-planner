// Pure address parser — no React, no Dexie.
//
// parseAddress(text) → { segments, derived }
//   segments: [{ id, raw, role }]  role = city|state|country|street|postcode|ignore
//   derived:  { city, state, country, address }  — recomputed from current roles
//
// deriveFields(segments) → { city, state, country, address }
//   Call this whenever segment roles change to live-update form fields.

import { findCountry } from './countries.js';

// Recognised street-word tokens (whole-word match, tolerate trailing '.').
// Multilingual: English / Polish / Hungarian / Spanish / German / Romanian / Bulgarian.
const STREET_WORDS = new Set([
  // English
  'street', 'st', 'rd', 'road', 'ave', 'avenue', 'blvd', 'boulevard',
  'lane', 'ln', 'sq', 'square', 'dr', 'drive', 'way', 'close', 'court', 'ct',
  // Polish
  'ul', 'ulica', 'al', 'aleja', 'plac',
  // Hungarian
  'utca', 'út', 'u', 'tér', 'körút', 'krt',
  // Spanish
  'calle', 'av', 'avda', 'avenida', 'plaza', 'paseo',
  // German
  'straße', 'strasse', 'str', 'platz', 'weg', 'gasse', 'allee',
  // Romanian / Bulgarian
  'strada', 'bulevardul', 'bd', 'calea', 'piața', 'bul',
  // Bulgarian Cyrillic
  'пл', 'ул', 'бул', 'площад', 'булевард',
  // Czech / additional Polish
  'nám', 'rynek',
]);

const DISTRICT_FRAGMENTS = [
  // Sofia districts
  'sofia center', 'sofia centre', 'софия център', 'sofia centar',
  'oborishte', 'lozenets', 'mladost', 'lyulin', 'nadezhda',
  // Generic patterns
  'city center', 'city centre', 'old town', 'stare miasto',
  'kazimierz', 'śródmieście', 'centrum',
  // Malls and commercial centres
  'mall of sofia', 'mall of', 'paradise center', 'serdika center',
  'national palace of culture', 'ndk',
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True when a single token looks like a standalone postcode.
function isPostcodeToken(token) {
  const t = token.trim();
  // Polish / generic hyphenated: 31-124
  if (/^\d{2}-\d{3}$/.test(t)) return true;
  // Pure numeric 4–7 digits: 2030, 62704, 80331
  if (/^\d{4,7}$/.test(t)) return true;
  // UK alphanumeric: SW1A 1AA (as full segment with space)
  if (/^[A-Z]{1,2}\d[A-Z\d]?\s\d[A-Z]{2}$/i.test(t)) return true;
  return false;
}

function classifySegment(segment) {
  const trimmed = segment.trim();

  // Lone digit(s) — building-number prefix split off by a comma (e.g. "6, ul. Foo")
  if (/^\d{1,3}$/.test(trimmed)) return 'ignore';

  // Check whole segment first (catches UK postcodes with internal space)
  if (isPostcodeToken(trimmed)) return 'postcode';

  // Check each space-separated token — if any is a standalone postcode,
  // classify the whole segment as postcode (handles "IL 62704", "PL 30200", etc.)
  const tokens = trimmed.split(/\s+/);
  if (tokens.some(isPostcodeToken)) return 'postcode';

  // Street: contains a recognised street-word OR ends in a building number
  for (const tok of tokens) {
    const norm = tok.replace(/\.$/, '').toLowerCase();
    if (STREET_WORDS.has(norm)) return 'street';
  }
  if (/\s\d+(-\d+)?[a-zA-Z]?$/.test(trimmed)) return 'street';

  // English "N word str[.]" — e.g. "1 Dimchev str" appended after a Cyrillic address
  if (/^\d+\s+\w+\s+str\.?$/i.test(trimmed)) return 'street';

  return 'city';
}

// Split a segment that glues a postcode prefix to a city name:
//   "31-042 Kraków" → ["31-042", "Kraków"]
//   "08001 Barcelona" → ["08001", "Barcelona"]
// Returns null when no glue pattern is found.
function trySplitGlue(segment) {
  const t = segment.trim();
  // Polish XX-XXX + city
  let m = t.match(/^(\d{2}-\d{3})\s+(\S.*)$/);
  if (m) return [m[1], m[2]];
  // Pure-digit postcode (4–7) + city starting with a non-digit
  m = t.match(/^(\d{4,7})\s+([^\d]\S.*)$/);
  if (m) return [m[1], m[2]];
  return null;
}

// Monotonically increasing id so chips have stable React keys across parses.
let _nextId = 1;

export function parseAddress(text) {
  if (!text?.trim()) return { segments: [], derived: { city: '', state: '', country: '', address: '' } };

  const countryMatch = findCountry(text);

  // Remove the matched country token from the working string, then tidy up
  // orphaned commas and whitespace.
  let working = text;
  if (countryMatch) {
    const re = new RegExp('\\b' + escapeRegex(countryMatch.matchedText) + '\\b', 'i');
    working = working.replace(re, '');
    working = working
      .replace(/,\s*,/g, ',')
      .replace(/^\s*,\s*/, '')
      .replace(/\s*,\s*$/, '')
      .trim();
  }

  // Comma-split, glue-expand, classify
  const rawParts = working.split(',').map(p => p.trim()).filter(Boolean);
  const expanded = [];
  for (const part of rawParts) {
    const split = trySplitGlue(part);
    if (split) expanded.push(...split);
    else expanded.push(part);
  }

  let segments = expanded.map(raw => ({ id: _nextId++, raw, role: classifySegment(raw) }));

  // Demote known district/neighbourhood labels from city → ignore so deriveFields
  // picks the real city name from whatever city chip remains.
  segments = segments.map(seg => {
    if (seg.role !== 'city') return seg;
    const lower = seg.raw.toLowerCase().trim();
    if (DISTRICT_FRAGMENTS.some(d => lower === d || lower.startsWith(d + ' ') || lower.endsWith(' ' + d))) {
      return { ...seg, role: 'ignore' };
    }
    if (/\b(mall|shopping\s+cent(re|er)|галерия)\b/i.test(seg.raw)) {
      return { ...seg, role: 'ignore' };
    }
    return seg;
  });

  // Append the country chip (relabel-able, but starts as 'country')
  if (countryMatch) {
    segments.push({ id: _nextId++, raw: countryMatch.matchedText, role: 'country' });
  }

  const derived = deriveFields(segments);
  return { segments, derived };
}

// Recompute { city, state, country, address } from current segment roles.
// city    = last 'city' chip (last-wins; district before city pattern)
// state   = last 'state' chip
// country = last 'country' chip
// address = 'street' + 'postcode' chips joined with ', ' (original order)
// 'ignore' chips contribute to nothing.
export function deriveFields(segments) {
  const cityChips  = [];
  const stateChips = [];
  let country = '';
  const addrParts = [];

  for (const seg of segments) {
    if      (seg.role === 'city')    { cityChips.push(seg.raw); }
    else if (seg.role === 'state')   { stateChips.push(seg.raw); }
    else if (seg.role === 'country') { country = seg.raw; }
    else if (seg.role === 'street' || seg.role === 'postcode') { addrParts.push(seg.raw); }
  }

  return {
    city:    cityChips.length  ? cityChips[cityChips.length - 1]   : '',
    state:   stateChips.length ? stateChips[stateChips.length - 1] : '',
    country,
    address: addrParts.join(', '),
  };
}
