// Pure parser: Google Maps hours text → partial openingHours object.
// Only sets keys for days explicitly present in the text.
// Absent keys = unknown (data contract); null = Closed; {open,close} = open.
//
// Format A — alternating lines (desktop copy-paste):
//   Monday\n12 PM–12 AM\nTuesday\nClosed
// Format B — day: hours per line:
//   Monday–Friday: 12–10 pm\nSaturday: Closed

const DAY_MAP = {
  monday: 'mon', tuesday: 'tue', wednesday: 'wed', thursday: 'thu',
  friday: 'fri', saturday: 'sat', sunday: 'sun',
};
const DAY_ORDER = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function dayKey(name) {
  return DAY_MAP[name.toLowerCase().trim()] || null;
}

// Expand a weekday range (mon–fri) into an ordered list of keys.
function expandRange(from, to) {
  const a = DAY_ORDER.indexOf(from);
  const b = DAY_ORDER.indexOf(to);
  if (a < 0 || b < 0) return from ? [from] : [];
  if (a <= b) return DAY_ORDER.slice(a, b + 1);
  // wrapping range e.g. Fri–Mon
  return [...DAY_ORDER.slice(a), ...DAY_ORDER.slice(0, b + 1)];
}

// Parse a single time string (12h or 24h) → "HH:MM" or null.
function parseTime(s) {
  s = s.trim().toLowerCase();
  // 24h: "13:30", "08:00"
  let m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h <= 23) return `${String(h).padStart(2, '0')}:${m[2]}`;
  }
  // 12h: "10 am", "12:30 pm", "2 AM"
  m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] || '00';
    if (m[3].toLowerCase() === 'am') { if (h === 12) h = 0; }
    else                             { if (h !== 12) h += 12; }
    if (h <= 23) return `${String(h).padStart(2, '0')}:${min}`;
  }
  // Bare hour: "12" or "9" — treat as HH:00 (handles "12 – 10 pm" open side)
  m = s.match(/^(\d{1,2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h >= 1 && h <= 23) return `${String(h).padStart(2, '0')}:00`;
  }
  return null;
}

// Parse a single "open–close" range (no Closed/24h/comma handling) →
// {open,close} | undefined. Factored out of parseHoursValue so the
// split-hours pre-check below can reuse it without duplicating the
// dash-splitting / PM-inference logic.
function parseSingleRange(s) {
  // Split on en-dash, em-dash, or space-hyphen-space
  const m = s.match(/^(.+?)\s*[–—]\s*(.+)$/) || s.match(/^(.+?)\s+-\s+(.+)$/);
  if (!m) return undefined;

  const rawOpen  = m[1].trim();
  const rawClose = m[2].trim();

  let open  = parseTime(rawOpen);
  const close = parseTime(rawClose);
  if (!open || !close) return undefined;

  // PM inference: when the close side has an explicit "pm" suffix and the open
  // side has no am/pm, treat the open side as pm too — but only if that produces
  // a logical range (open < close). Example: "2–10:30 pm" → 14:00–22:30.
  // This does NOT fire when close is 24h ("10–22:00") because there is no "pm".
  const openHasAmPm = /\b(am|pm)\b/i.test(rawOpen);
  const closeHasPm  = /\bpm\b/i.test(rawClose);
  if (!openHasAmPm && closeHasPm) {
    const openAsPm = parseTime(rawOpen + ' pm');
    if (openAsPm && openAsPm < close) open = openAsPm;
  }

  return { open, close };
}

// Parse a hours value string → null (Closed) | {open,close[,open2,close2]} | undefined (unparseable).
function parseHoursValue(s) {
  s = s.trim();
  if (/^closed$/i.test(s)) return null;
  if (/^open 24 hours$/i.test(s)) return { open: '00:00', close: '24:00' };

  // Split-hours pre-check: two ranges separated by a comma, e.g.
  // "12–3 pm, 4–9 pm" or "12:00–15:00, 16:00–21:00". Falls through to the
  // single-range parser below if this doesn't yield two valid ranges.
  if (s.includes(',')) {
    const parts = s.split(',').map((p) => p.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      const first  = parseSingleRange(parts[0]);
      const second = parseSingleRange(parts[1]);
      if (first && second) {
        return { open: first.open, close: first.close, open2: second.open, close2: second.close };
      }
    }
  }

  return parseSingleRange(s);
}

// Parse a day-name segment (possibly a range like "Monday–Friday") → array of keys.
function parseDaySegment(segment) {
  const m = segment.match(/^(.+?)\s*[–—-]\s*(.+)$/);
  if (m) {
    const from = dayKey(m[1]);
    const to   = dayKey(m[2]);
    if (from && to) return expandRange(from, to);
    if (from) return [from];
  }
  const k = dayKey(segment.trim());
  return k ? [k] : [];
}

export function parseGoogleHours(text) {
  const openingHours = {};
  const meta = {};
  const checkInMatch  = text.match(/check[- ]?in\s*(?:time\s*)?[:\-]\s*(\d{1,2}:\d{2})/i);
  const checkOutMatch = text.match(/check[- ]?out\s*(?:time\s*)?[:\-]\s*(\d{1,2}:\d{2})/i);
  if (checkInMatch)  meta.checkIn  = checkInMatch[1];
  if (checkOutMatch) meta.checkOut = checkOutMatch[1];

  const lines = text.split('\n').map(s => s.trim()).filter(Boolean);
  if (!lines.length) return { openingHours, meta };

  // Format B: lines containing "DayName: hours" with a colon separator
  const isFormatB = lines.some(l => /^[\w\s–—-]+:\s/.test(l) && !/^check/i.test(l));

  if (isFormatB) {
    for (const line of lines) {
      if (/^check/i.test(line)) continue; // handled by meta pre-pass
      const m = line.match(/^([\w\s–—-]+):\s*(.+)$/);
      if (!m) continue;
      const keys = parseDaySegment(m[1].trim());
      const val  = parseHoursValue(m[2].trim());
      if (val === undefined || !keys.length) continue;
      for (const k of keys) openingHours[k] = val;
    }
  } else {
    // Format A: alternating day-name / hours lines
    let i = 0;
    while (i < lines.length) {
      const keys = parseDaySegment(lines[i]);
      if (!keys.length) { i++; continue; }
      const hoursLine = lines[i + 1] || '';
      const val       = parseHoursValue(hoursLine);
      if (val !== undefined) {
        let entry    = val;
        let consumed = 2;
        // Split hours across two consecutive value lines for the same day
        // (e.g. "Tuesday\n12–3 pm\n4–9 pm") — only when the first line is a
        // plain open/close range (not Closed, not already comma-split) and
        // the next line isn't itself a weekday name.
        if (val && !val.open2) {
          const nextLine = lines[i + 2];
          if (nextLine !== undefined && !parseDaySegment(nextLine).length) {
            const second = parseHoursValue(nextLine);
            if (second && !second.open2) {
              entry    = { open: val.open, close: val.close, open2: second.open, close2: second.close };
              consumed = 3;
            }
          }
        }
        for (const k of keys) openingHours[k] = entry;
        i += consumed;
      } else {
        i++;
      }
    }
  }

  return { openingHours, meta };
}
