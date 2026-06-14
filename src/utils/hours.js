import { WEEKDAYS } from '../db/constants.js';

// ---------------------------------------------------------------------------
// Helpers for the openingHours structure:
//   { mon: { open: '10:00', close: '22:00' }, tue: null /* closed */, ... }
// These get reused by the place library and, later, the HTML day-sheet export
// (the "is it open today / opens at X" line).
// ---------------------------------------------------------------------------

// JS Date.getDay() is 0=Sun..6=Sat; map it to our 'mon'..'sun' keys.
const JS_DAY_TO_KEY = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function weekdayKeyFromDate(dateStr) {
  // dateStr is 'YYYY-MM-DD'. Parse as local date (avoid TZ surprises).
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return JS_DAY_TO_KEY[date.getDay()];
}

// "10:00–22:00" for a given weekday key, or "Closed", or "—" if unknown.
export function hoursForDay(openingHours, weekdayKey) {
  if (!openingHours) return '—';
  const h = openingHours[weekdayKey];
  if (h === null) return 'Closed';
  if (!h || !h.open || !h.close) return '—';
  return `${h.open}–${h.close}`;
}

// Compact one-line summary across the week, e.g. "Mon–Fri 10:00–22:00".
// Step-1 version keeps it simple: just lists days that have hours.
export function hoursSummary(openingHours) {
  if (!openingHours) return 'No hours yet';
  const parts = WEEKDAYS
    .map((w) => ({ ...w, h: openingHours[w.key] }))
    .filter((w) => w.h && w.h.open && w.h.close)
    .map((w) => `${w.label} ${w.h.open}–${w.h.close}`);
  return parts.length ? parts.join(' · ') : 'No hours yet';
}
