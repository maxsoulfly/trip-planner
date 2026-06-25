// Pure blob parser — no React, no Dexie.
//
// parseBlob(text) → { lines, extracted }
//   lines:     [{ raw, role }]
//     role = name | url-maps | url-untappd | url-website | url-facebook |
//            url-instagram | hours | address | checkin | checkout
//            (ignore-label lines are filtered out before being returned)
//   extracted: { name, url, lat, lng, nameFromUrl, shortUrl,
//                openingHours, addrSegments, addrDerived,
//                untappdUrl, websiteUrl, facebookUrl,
//                checkIn, checkOut }

import { parseMapsUrl }               from './mapsParser.js';
import { parseGoogleHours }           from './hoursParser.js';
import { findCountry }                from './countries.js';
import { parseAddress, deriveFields } from './addressParser.js';

// Whole-line weekday name (bare "Monday" or range "Monday–Friday" or "Mon–Fri").
const WEEKDAY_RE = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i;

// Format A time-value lines. am/pm before the dash is optional to catch "2–11 pm".
const TIME_VALUE_RE = /^\d{1,2}(?::\d{2})?\s*(?:am|pm)?\s*[–—-]/i;

const CLOSED_RE = /^(Closed|Open 24 hours)$/i;

function classifyUrl(line) {
  if (!/^https?:\/\//i.test(line)) return null;
  if (/google\.com\/maps|maps\.app\.goo\.gl/i.test(line))  return 'url-maps';
  if (/untappd\.com/i.test(line))                           return 'url-untappd';
  if (/facebook\.com|fb\.com/i.test(line))                  return 'url-facebook';
  if (/instagram\.com/i.test(line))                         return 'url-instagram';
  return 'url-website';
}

function classifyLine(raw) {
  const urlRole = classifyUrl(raw);
  if (urlRole) return urlRole;
  if (WEEKDAY_RE.test(raw) || CLOSED_RE.test(raw) || TIME_VALUE_RE.test(raw)) return 'hours';
  if (/check[- ]?in\s*(?:time\s*)?[:\-]\s*\d{1,2}:\d{2}/i.test(raw))  return 'checkin';
  if (/check[- ]?out\s*(?:time\s*)?[:\-]\s*\d{1,2}:\d{2}/i.test(raw)) return 'checkout';
  if (/^(suggest new hours|lunch|happy hours?|kitchen|popular times?|dine.?in|takeaway|delivery|drive.?through)$/i.test(raw)) return 'ignore-label';
  if (/,/.test(raw) && (/\d/.test(raw) || findCountry(raw))) return 'address';
  return 'name';
}

const EMPTY_EXTRACTED = {
  name: null, url: null, lat: null, lng: null, nameFromUrl: null, shortUrl: false,
  openingHours: null, addrSegments: null, addrDerived: null,
  untappdUrl: null, websiteUrl: null, facebookUrl: null,
  checkIn: null, checkOut: null,
};

export function parseBlob(text) {
  if (!text?.trim()) return { lines: [], extracted: { ...EMPTY_EXTRACTED } };

  const lines = text.split('\n')
    .map(raw => raw.trim())
    .filter(l => l.length > 0 && !/^[■-▣\s]+$/.test(l))
    .map(raw => ({ raw, role: classifyLine(raw) }))
    .filter(l => l.role !== 'ignore-label');

  const nameLine   = lines.find(l => l.role === 'name');
  const mapsLine   = lines.find(l => l.role === 'url-maps');
  const addrLine   = lines.find(l => l.role === 'address');
  const hoursLines = lines.filter(l => l.role === 'hours');

  // URL sub-types
  const untappdLine  = lines.find(l => l.role === 'url-untappd');
  const websiteLine  = lines.find(l => l.role === 'url-website');
  const facebookLine = lines.find(l => l.role === 'url-facebook' || l.role === 'url-instagram');

  // Check-in / check-out time extraction
  const checkinLine  = lines.find(l => l.role === 'checkin');
  const checkoutLine = lines.find(l => l.role === 'checkout');
  const checkIn  = checkinLine  ? (checkinLine.raw.match(/(\d{1,2}:\d{2})/)?.[1]  ?? null) : null;
  const checkOut = checkoutLine ? (checkoutLine.raw.match(/(\d{1,2}:\d{2})/)?.[1] ?? null) : null;

  // Maps URL → coords + nameFromUrl
  let url = null, lat = null, lng = null, nameFromUrl = null, shortUrl = false;
  if (mapsLine) {
    url = mapsLine.raw;
    const parsed = parseMapsUrl(url);
    if (parsed.short) {
      shortUrl = true;
    } else {
      lat = parsed.lat;
      lng = parsed.lng;
      nameFromUrl = parsed.name || null;
    }
  }

  const name = nameLine?.raw ?? nameFromUrl ?? null;

  // Hours: join all hours-classified lines (blanks already stripped by filter)
  let openingHours = null;
  if (hoursLines.length) {
    const { openingHours: parsed } = parseGoogleHours(hoursLines.map(l => l.raw).join('\n'));
    if (Object.keys(parsed).length > 0) openingHours = parsed;
  }

  // Address chips
  let addrSegments = null, addrDerived = null;
  if (addrLine) {
    const result = parseAddress(addrLine.raw);
    if (result.segments.length) {
      addrSegments = result.segments;
      addrDerived  = result.derived;
    }
  }

  const extracted = {
    name, url, lat, lng, nameFromUrl, shortUrl,
    openingHours, addrSegments, addrDerived,
    untappdUrl:  untappdLine?.raw  ?? null,
    websiteUrl:  websiteLine?.raw  ?? null,
    facebookUrl: facebookLine?.raw ?? null,
    checkIn, checkOut,
  };
  return { lines, extracted };
}
