// ---------------------------------------------------------------------------
// mapsParser.js — extracts Place fields from a Google Maps URL.
//
// URL shapes handled and what each yields:
//
//   1. Place URL (full desktop/browser):
//      https://www.google.com/maps/place/Świat+Piwa/@50.0588,19.9371,17z/data=...
//      → name (URL-decoded), lat, lng
//
//   2. Search URL:
//      https://www.google.com/maps/search/craft+beer+bar/@50.061,19.938,15z/...
//      → name (decoded search query), lat, lng
//
//   3. Coordinate-only URL (no place/search segment):
//      https://www.google.com/maps/@50.0588,19.9371,17z
//      → lat, lng only (name = null)
//
//   4. Short URL — maps.app.goo.gl or goo.gl/maps:
//      https://maps.app.goo.gl/AbCdEf123
//      → nothing extracted; returns { short: true }.
//      Caller must show a warning: the redirect can't be followed client-side.
//
//   5. Anything else (non-Maps URL, empty string, garbage):
//      → all null, short: false. Caller stores the URL and moves on.
//
// Fields NOT in any URL — require the Maps API (no backend in v1):
//   address, opening hours, phone number, place type, website.
//
// Reused by: PlaceForm prefill (step 3), xlsx importer (step 6).
// ---------------------------------------------------------------------------

export function parseMapsUrl(rawUrl) {
  const result = { name: null, lat: null, lng: null, short: false };

  const url = typeof rawUrl === 'string' ? rawUrl.trim() : '';
  if (!url) return result;

  // Short URL — can't resolve without a backend. Signal to caller.
  if (/maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url)) {
    return { ...result, short: true };
  }

  // Name — from /maps/place/ENCODED_NAME/ or /maps/search/ENCODED_NAME/
  // The segment ends at a '/' or '@' or '?' or '#'.
  const nameMatch = url.match(/\/maps\/(?:place|search)\/([^/@?#]+)/);
  if (nameMatch) {
    try {
      result.name = decodeURIComponent(nameMatch[1].replace(/\+/g, ' ')).trim() || null;
    } catch {
      // Malformed percent-encoding — skip name rather than crash.
    }
  }

  // Lat/lng — from the @LAT,LNG,ZOOMz anchor present in place, search,
  // and bare coordinate URLs.
  const coordMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (coordMatch) {
    result.lat = parseFloat(coordMatch[1]);
    result.lng = parseFloat(coordMatch[2]);
  }

  return result;
}
