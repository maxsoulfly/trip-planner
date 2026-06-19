// Pure export — no React, no Dexie.
// exportTripXlsx(trip, scheduleItems, placesMap) builds and downloads .xlsx.

import * as XLSX from 'xlsx';
import { BLOCKS } from '../db/constants.js';
import { daysInRange } from './dates.js';

const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// 'YYYY-MM-DD' → 'Fri 20/06'
function colHeader(dateStr) {
  const d   = parseLocal(dateStr);
  const dd  = String(d.getDate()).padStart(2, '0');
  const mm  = String(d.getMonth() + 1).padStart(2, '0');
  return `${DAY_ABBR[d.getDay()]} ${dd}/${mm}`;
}

// Derive city for a given date from scheduled items (most-common city that day).
function cityForDay(date, scheduleItems, placesMap, trip) {
  const items = scheduleItems.filter((si) => si.date === date && si.placeId);
  if (items.length === 0) return trip.cities?.[0] || '';
  const counts = {};
  for (const item of items) {
    const city = placesMap[item.placeId]?.city || '';
    if (city) counts[city] = (counts[city] || 0) + 1;
  }
  const entries = Object.entries(counts);
  if (entries.length === 0) return trip.cities?.[0] || '';
  return entries.sort((a, b) => b[1] - a[1])[0][0];
}

export function exportTripXlsx(trip, scheduleItems, placesMap) {
  if (!trip.startDate || !trip.endDate) return;
  const days = daysInRange(trip.startDate, trip.endDate);
  if (days.length === 0) return;

  // Index: "date|block" → items sorted by order
  const slotIndex = {};
  for (const item of scheduleItems) {
    const key = `${item.date}|${item.block}`;
    if (!slotIndex[key]) slotIndex[key] = [];
    slotIndex[key].push(item);
  }
  for (const key of Object.keys(slotIndex)) {
    slotIndex[key].sort((a, b) => a.order - b.order);
  }

  const rows = [];

  // Row 0 — day headers
  rows.push(['', ...days.map(colHeader)]);

  // Row 1 — city per day
  rows.push(['', ...days.map((d) => cityForDay(d, scheduleItems, placesMap, trip))]);

  // 5 block groups × 3 sub-rows
  for (const block of BLOCKS) {
    for (let sub = 0; sub < 3; sub++) {
      const row = [sub === 0 ? block.label.toUpperCase() : ''];
      for (const date of days) {
        const items = slotIndex[`${date}|${block.key}`] || [];
        const item  = items[sub];
        if (!item) {
          row.push('');
        } else if (item.kind === 'place') {
          row.push(placesMap[item.placeId]?.name || '');
        } else {
          row.push(item.adHoc?.label || '');
        }
      }
      rows.push(row);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Schedule');

  const filename = (trip.title || 'trip').replace(/\s+/g, '-') + '-schedule.xlsx';
  XLSX.writeFile(wb, filename);
}
