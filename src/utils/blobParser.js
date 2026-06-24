// Pure blob parser — no React, no Dexie.
//
// parseBlob(text) → { lines, extracted }
//   lines:     [{ raw, role }]  role = name|url|hours|address
//   extracted: { name, url, lat, lng, nameFromUrl, shortUrl,
//                openingHours, addrSegments, addrDerived }

import { parseMapsUrl }          from './mapsParser.js';
import { parseGoogleHours }      from './hoursParser.js';
import { findCountry }           from './countries.js';
import { parseAddress, deriveFields } from './addressParser.js';

const WEEKDAY_RE    = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b/i;
// Format A value lines: "2–11 PM", "12 PM–12 AM"
const TIME_VALUE_RE = /^\d{1,2}(?::\d{2})?\s*(am|pm)\s*[–—-]/i;
const CLOSED_RE     = /^(Closed|Open 24 hours)$/i;

function classifyLine(raw) {
  if (/^https?:\/\//i.test(raw) && /google\.com\/maps|maps\.app\.goo\.gl/i.test(raw)) return 'url';
  if (WEEKDAY_RE.test(raw) || CLOSED_RE.test(raw) || TIME_VALUE_RE.test(raw)) return 'hours';
  if (/,/.test(raw) && (/\d/.test(raw) || findCountry(raw))) return 'address';
  return 'name';
}

export function parseBlob(text) {
  if (!text?.trim()) {
    return { lines: [], extracted: { name: null, url: null, lat: null, lng: null,
      nameFromUrl: null, shortUrl: false, openingHours: null, addrSegments: null, addrDerived: null } };
  }

  const lines = text.split('\n')
    .map(raw => raw.trim())
    .filter(Boolean)
    .map(raw => ({ raw, role: classifyLine(raw) }));

  // Extract from classified lines
  const nameLine    = lines.find(l => l.role === 'name');
  const urlLine     = lines.find(l => l.role === 'url');
  const addrLine    = lines.find(l => l.role === 'address');
  const hoursLines  = lines.filter(l => l.role === 'hours');

  // URL → coords + nameFromUrl
  let url = null, lat = null, lng = null, nameFromUrl = null, shortUrl = false;
  if (urlLine) {
    url = urlLine.raw;
    const parsed = parseMapsUrl(url);
    if (parsed.short) {
      shortUrl = true;
    } else {
      lat = parsed.lat;
      lng = parsed.lng;
      nameFromUrl = parsed.name || null;
    }
  }

  // Name: explicit blob line wins over URL-decoded name
  const name = nameLine?.raw ?? nameFromUrl ?? null;

  // Hours: join all hours lines, parse
  let openingHours = null;
  if (hoursLines.length) {
    const parsed = parseGoogleHours(hoursLines.map(l => l.raw).join('\n'));
    if (Object.keys(parsed).length > 0) openingHours = parsed;
  }

  // Address: first address line → segment chips
  let addrSegments = null, addrDerived = null;
  if (addrLine) {
    const result = parseAddress(addrLine.raw);
    if (result.segments.length) {
      addrSegments = result.segments;
      addrDerived  = result.derived;
    }
  }

  const extracted = { name, url, lat, lng, nameFromUrl, shortUrl, openingHours, addrSegments, addrDerived };
  return { lines, extracted };
}
