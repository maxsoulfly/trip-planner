// ---------------------------------------------------------------------------
// Parse 'YYYY-MM-DD' as a LOCAL date to avoid UTC offset shifts.
// new Date('2026-06-14') is midnight UTC → Jun 13 in UTC+2/+3 (Israel).
// Same pattern used in src/utils/hours.js weekdayKeyFromDate.
// ---------------------------------------------------------------------------

function parseLocal(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const DAY_ABBR   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Returns ['YYYY-MM-DD', ...] for every day from startDate to endDate inclusive.
export function daysInRange(startDate, endDate) {
  const days = [];
  const cur  = parseLocal(startDate);
  const end  = parseLocal(endDate);
  while (cur <= end) {
    const y = cur.getFullYear();
    const m = String(cur.getMonth() + 1).padStart(2, '0');
    const d = String(cur.getDate()).padStart(2, '0');
    days.push(`${y}-${m}-${d}`);
    cur.setDate(cur.getDate() + 1);
  }
  return days;
}

// 'YYYY-MM-DD' → 'MON · Jun 14'  (column header in the trip grid)
export function formatDayHeader(dateStr) {
  const d = parseLocal(dateStr);
  return `${DAY_ABBR[d.getDay()]} · ${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`;
}
