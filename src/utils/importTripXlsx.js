// Pure import parser — no React, no Dexie.
// Reads a workbook produced by exportTripXlsx and returns structured data.
// The caller is responsible for all DB writes.
//
// Returns: { toSchedule, stubPlaces, warnings }
//   toSchedule: array of schedule items; "place" kind items have either
//     placeId (matched) or stubName (unmatched — resolved by caller after
//     addPlace() returns the new ID).
//   stubPlaces: new place objects ready to pass to addPlace().
//   warnings:   human-readable strings for the summary UI.

import * as XLSX from 'xlsx';

const BLOCKS = ['morning', 'noon', 'late_afternoon', 'evening', 'night'];

function daysInRange(startDate, endDate) {
  const days = [];
  const [sy, sm, sd] = startDate.split('-').map(Number);
  const [ey, em, ed] = endDate.split('-').map(Number);
  const cur = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

function norm(name) {
  return (name || '').trim().toLowerCase();
}

export function parseTripXlsx(workbook, trip, allPlaces) {
  const toSchedule = [];
  const stubPlaces = [];
  const warnings   = [];

  if (!trip.startDate || !trip.endDate) {
    return { toSchedule, stubPlaces, warnings: ['Trip has no date range — cannot parse schedule'] };
  }

  const ws = workbook.Sheets[workbook.SheetNames[0]];
  if (!ws) return { toSchedule, stubPlaces, warnings: ['Workbook is empty'] };

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  if (rows.length < 3) return { toSchedule, stubPlaces, warnings: ['Sheet has too few rows'] };

  const tripDays = daysInRange(trip.startDate, trip.endDate);

  // Map col index → date string (col 0 is the label column, col 1..N are days)
  const colToDate = {};
  for (let c = 1; c <= tripDays.length; c++) {
    colToDate[c] = tripDays[c - 1];
  }

  // Build name → places[] lookup (normalized)
  const byName = {};
  for (const p of allPlaces) {
    const key = norm(p.name);
    if (!byName[key]) byName[key] = [];
    byName[key].push(p);
  }

  const tripCities = new Set((trip.cities || []).map((c) => norm(c)));

  function findPlace(name) {
    const matches = byName[norm(name)] || [];
    if (matches.length === 0) return null;
    if (matches.length === 1) return matches[0];
    // Prefer match in trip's cities
    if (tripCities.size > 0) {
      const inCity = matches.filter((p) => tripCities.has(norm(p.city)));
      if (inCity.length > 0) return inCity[0];
    }
    return matches[0];
  }

  // Stubs deduped by normalized name
  const stubSeen = new Set();

  // Rows 0 = day headers, 1 = cities, then blocks starting at row 2
  for (let blockIdx = 0; blockIdx < BLOCKS.length; blockIdx++) {
    const block   = BLOCKS[blockIdx];
    const baseRow = 2 + blockIdx * 3;

    for (let sub = 0; sub < 3; sub++) {
      const rowData = rows[baseRow + sub] || [];

      for (const [colStr, date] of Object.entries(colToDate)) {
        const col     = parseInt(colStr, 10);
        const cellVal = String(rowData[col] || '').trim();
        if (!cellVal) continue;

        const place = findPlace(cellVal);
        if (place) {
          toSchedule.push({ placeId: place.id, date, block, order: sub, kind: 'place' });
        } else {
          const key = norm(cellVal);
          // Only create one stub per unique name, but schedule each occurrence
          if (!stubSeen.has(key)) {
            stubSeen.add(key);
            stubPlaces.push({
              name:      cellVal.trim(),
              city:      trip.cities?.[0] || '',
              status:    'wishlist',
              type:      'other',
            });
            warnings.push(`'${cellVal}' not found in library — added as new place`);
          }
          // Use stubName so the UI can resolve to a placeId after addPlace()
          toSchedule.push({ stubName: key, date, block, order: sub, kind: 'place' });
        }
      }
    }
  }

  return { toSchedule, stubPlaces, warnings };
}
