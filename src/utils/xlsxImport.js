// Pure parser for Travel_Plans_Yana.xlsx.
// Takes a SheetJS workbook object (from XLSX.read()), returns { places, warnings }.
// Each place: { name, type, city, country, address, openingHours }
// openingHours follows the data contract: absent = unknown, null = closed, {open,close} = open.

import * as XLSX from 'xlsx';

// ── Hebrew weekday → key ──────────────────────────────────────────────────────
const HEB_DAY = {
  'שבת': 'sat', 'ראשון': 'sun', 'שני': 'mon',
  'שלישי': 'tue', 'רביעי': 'wed', 'חמישי': 'thu', 'שישי': 'fri',
};

// ── English day-name prefix → key ────────────────────────────────────────────
const EN_DAY_PREFIX = [
  ['monday', 'mon'], ['tuesday', 'tue'], ['wednesday', 'wed'],
  ['thursday', 'thu'], ['friday', 'fri'], ['saturday', 'sat'], ['sunday', 'sun'],
];

const HEBREW_RE    = /[֐-׿]/;
const FLIGHT_RE    = /^[A-Z0-9]{2}\d{3,4}$/;
const AIRPORT_RE   = /^[A-Z]{3}$/;
const TRANSIT_RE   = /\b(train|flight|bus|plane|airport|taxi|uber|metro|check[\s-]?in|check[\s-]?out)\b/i;

// FIX-3: airline name prefixes
const AIRLINE_RE   = /^(wizz\s?air|ryan\s?air|lot|easyjet|lufthansa)\s/i;
// FIX-3: bare airline-code + flight number with optional space ("W6 2098", "6H 171")
const FLIGHT2_RE   = /^[A-Z0-9]{2}\s?\d{3,4}$/;

// FIX-1 (budget) + FIX-7 (misc): exact-match blocklist (compared lowercase)
const EXACT_BLOCK  = new Set([
  'card1', 'card2', 'split diff', 'cash diff', 'meads',   // budget rows from Hebrew tables
  '-or-', 'katowice', 'warszawa centrum', 'city tour',     // direction/nav labels
]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function dayKeyFromCell(val) {
  if (!val) return null;
  const s = String(val).trim();
  // Hebrew: match at start (cell may have date appended)
  for (const [heb, key] of Object.entries(HEB_DAY)) {
    if (s.startsWith(heb)) return key;
  }
  // English: case-insensitive prefix
  const lower = s.toLowerCase();
  for (const [prefix, key] of EN_DAY_PREFIX) {
    if (lower.startsWith(prefix)) return key;
  }
  return null;
}

function normalizeType(s) {
  if (!s) return 'other';
  const t = String(s).toLowerCase().trim();
  if (t.includes('taproom'))                         return 'taproom';
  if (t.includes('brewpub') || t.includes('brewery')) return 'brewpub';
  if (t.includes('bottle') || t.includes('shop') || t.includes('store')) return 'bottle_shop';
  if (t.includes('bar') || t.includes('pub'))        return 'bar';
  if (t.includes('restaurant'))                      return 'restaurant';
  if (t.includes('cafe') || t.includes('café'))      return 'cafe';
  return 'other';
}

function parseTimeStr(t) {
  if (!t) return null;
  t = String(t).trim().toLowerCase();
  // 24h: "13:30"
  let m = t.match(/^(\d{1,2}):(\d{2})$/);
  if (m) {
    const h = parseInt(m[1], 10);
    if (h <= 23) return `${String(h).padStart(2, '0')}:${m[2]}`;
  }
  // 12h: "12:00 pm", "4 pm", "10:30 am"
  m = t.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (m) {
    let h = parseInt(m[1], 10);
    const min = m[2] || '00';
    if (m[3] === 'am') { if (h === 12) h = 0; }
    else if (h !== 12) h += 12;
    if (h <= 23) return `${String(h).padStart(2, '0')}:${min}`;
  }
  return null;
}

function parseHoursString(raw) {
  if (!raw) return null;
  const str = String(raw).trim();
  if (!str) return null;
  // Excel date serial stored as string
  if (/^\d{5,6}$/.test(str)) return null;

  // Match "A – B", "A — B", "A - B" (with surrounding spaces), "HH:MM-HH:MM"
  let a, b;
  let m = str.match(/^(.+?)\s*[–—]\s*(.+)$/);
  if (m) { a = m[1]; b = m[2]; }
  else {
    m = str.match(/^(.+?)\s+-\s+(.+)$/);
    if (m) { a = m[1]; b = m[2]; }
    else {
      // No spaces around dash — only treat as range if both sides parse as times
      m = str.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/);
      if (m) { a = m[1]; b = m[2]; }
    }
  }
  if (a && b) {
    const open = parseTimeStr(a.trim());
    const close = parseTimeStr(b.trim());
    if (open && close) return { open, close };
  }
  return null;
}

function cellHours(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return null; // Excel date serial stored as number
  return parseHoursString(val);
}

function cleanName(s) {
  if (!s) return '';
  s = String(s).trim();
  // Strip annotation after " - " (e.g., "Antycafe - שלישים" → "Antycafe")
  s = s.replace(/\s+-\s+.*$/, '');
  // Strip trailing explicit HH:MM–HH:MM hours range
  s = s.replace(/\s+\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}.*$/, '');
  // FIX-9: strip trailing (...) whose content is a time/hours annotation
  //   catches: "Swiat Piwa (From 10)", "Finca Brunch (7:30-16)", "Emalia Zablocie (9-22)"
  s = s.replace(/\s*\([^)]*(?:\d{1,2}[:\s]?\d{0,2}\s*(?:am|pm)?[\s\-–]+|from\s+|until\s+)[^)]*\)$/i, '');
  // FIX-9b: strip trailing "(?) " confidence marker
  s = s.replace(/\s*\(\?\)$/, '');
  // FIX-1k: strip trailing " -" fragment (e.g., "Aubergine -" → "Aubergine")
  s = s.replace(/\s+-$/, '');
  return s.trim();
}

function isNonVenue(s) {
  s = String(s).trim();
  if (!s || s.length < 3)         return true;
  if (HEBREW_RE.test(s))          return true;   // Hebrew text
  if (FLIGHT_RE.test(s))          return true;   // flight codes e.g. "W62098"
  if (FLIGHT2_RE.test(s))         return true;   // FIX-3: "W6 2098", "6H 171"
  if (AIRPORT_RE.test(s))         return true;   // bare 3-letter codes: TLV, KRK, WAW
  if (AIRLINE_RE.test(s))         return true;   // FIX-3: "Wizz Air …", "Ryan Air …"
  // FIX-1+7: exact-match blocklist (budget labels, direction labels)
  if (EXACT_BLOCK.has(s.toLowerCase())) return true;
  // FIX-4: no Latin letters at all — emoji-only or symbol-only tokens
  if (!/[a-zA-Z]/.test(s))        return true;
  // FIX-5: flight emoji prefix
  if (s.startsWith('✈'))          return true;
  // FIX-1a: parenthesised tokens — always noise (inline hours, notes, flight refs)
  if (s.startsWith('('))          return true;
  // FIX-1b: 3 uppercase letters + space/digit (airport+time: "TLV 09:15", "WAW to TLV")
  if (/^[A-Z]{3}[\s\d]/.test(s)) return true;
  // FIX-1c: "From …" / "Until …" openers (standalone opening-hour annotations)
  if (/^(From|Until)\s/i.test(s)) return true;
  // FIX-6: "open from …" / "opens at …" (venue descriptions, not names)
  if (/^open\s+from/i.test(s))    return true;
  if (/^opens?\s+at/i.test(s))    return true;
  // FIX-1d: "Option N" decision/booking labels
  if (/^Option\s\d/i.test(s))     return true;
  // FIX-1e: standalone time strings ("18:00", "From 18:00")
  if (/^(From\s)?\d{1,2}:\d{2}/.test(s)) return true;
  // FIX-1f: day-block / schedule template labels (exact match, case-insensitive)
  if (/^(morning|noon|late|afternoon|evening|night|time of day|what'?s running|late afternoon|night stay)$/i.test(s)) return true;
  // FIX-1g: date strings like "14.02.25"
  if (/^\d{1,2}\.\d{2}\.\d{2,4}$/.test(s)) return true;
  // FIX-2 (date filter extension): day-name + date "Friday, 14.02.25"
  if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday),?\s+\d/i.test(s)) return true;
  // FIX-1h: standalone day names (bare, no trailing date)
  if (/^(monday|tuesday|wednesday|thursday|friday|saturday|sunday)$/i.test(s)) return true;
  // FIX-1i: transit / navigation labels
  if (/^(city tour|go to |to [A-Z]|from [a-z])/i.test(s)) return true;
  // FIX-1l: pure numeric or digit+punctuation tokens (replaces old blanket /^\d/ check)
  //   keeps "100 Beers" (has letters after digit) but rejects "100", "12:00", "15-00", "45395"
  if (/^\d+$/.test(s))              return true;
  if (/^\d[\d\s\.\:\-]+$/.test(s))  return true;
  if (TRANSIT_RE.test(s))           return true;  // transit keywords (train, flight, etc.)
  return false;
}

// FIX-8: infer place type from name patterns (grid rows have no explicit type column)
function inferType(name) {
  const n = name.toLowerCase();
  // Street address patterns → accommodation
  if (/^(ul\.|str\.|strada |noclegi |hotel |hostel )/i.test(name)) return 'accommodation';
  // "Titanic" hotel chain
  if (n.includes('titanic')) return 'accommodation';
  // Ends with a number AND has ≥3 words → likely a street address
  if (/\s\d{1,4}$/.test(name) && name.trim().split(/\s+/).length >= 3) return 'accommodation';
  return 'other';
}

// ── Grid extractor (rows 3–9, 0-indexed) ─────────────────────────────────────
// Handles multi-city: scans all rows 0–9 for city-switch keywords.
// When "Warsaw"/"Warszawa" found in a column, that column and all after → Warsaw.
// When "Krakow"/"Kraków" found, resets to Krakow. Katowice similarly.
function extractGrid(rows, defaultCity, country) {
  const maxCols = rows.reduce((mx, r) => Math.max(mx, r.length), 0);
  const colCity = new Array(maxCols).fill(defaultCity);

  // Per-column override based on city keywords found anywhere in rows 0–9
  for (let r = 0; r <= Math.min(9, rows.length - 1); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const cell = String(row[c] || '').toLowerCase();
      if (cell.includes('warsaw') || cell.includes('warszawa')) {
        // Mark this column and all after as Warsaw
        for (let i = c; i < maxCols; i++) colCity[i] = 'Warsaw';
      } else if (cell.includes('krakow') || cell.includes('kraków')) {
        for (let i = c; i < maxCols; i++) colCity[i] = 'Krakow';
      } else if (cell.includes('katowice')) {
        for (let i = c; i < maxCols; i++) colCity[i] = 'Katowice';
      }
    }
  }

  const seen = new Set();
  const places = [];

  for (let r = 3; r <= Math.min(9, rows.length - 1); r++) {
    const row = rows[r] || [];
    for (let c = 0; c < row.length; c++) {
      const raw = String(row[c] || '').trim();
      if (!raw) continue;
      const city = colCity[c] || defaultCity;

      for (const token of raw.split(/\n/)) {
        const name = cleanName(token);
        if (!name || isNonVenue(name)) continue;
        const key = `${name.toLowerCase()}|${city.toLowerCase()}`;
        if (seen.has(key)) continue;
        seen.add(key);
        places.push({ name, type: inferType(name), city, country, address: '', openingHours: {} });
      }
    }
  }
  return places;
}

// ── Madrid Aug 2024 ───────────────────────────────────────────────────────────
// Structured table: Day | Place | Type | Opening Hours | Address
function parseMadrid(rows) {
  const places = [];
  const seen = new Set();

  let startRow = -1;
  for (let r = 0; r < rows.length; r++) {
    if (String(rows[r][1] || '').toLowerCase().trim() === 'place') {
      startRow = r + 1;
      break;
    }
  }
  if (startRow < 0) return places;

  for (let r = startRow; r < rows.length; r++) {
    const row = rows[r];
    const name = cleanName(row[1]);
    if (!name || isNonVenue(name)) continue;

    const dayKey = dayKeyFromCell(row[0]);
    const hrs    = cellHours(row[3]);
    const address = String(row[4] || '').trim();

    const openingHours = {};
    if (dayKey && hrs) openingHours[dayKey] = hrs;

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    places.push({
      name,
      type: normalizeType(row[2]),
      city: 'Madrid',
      country: 'Spain',
      address,
      openingHours,
    });
  }
  return places;
}

// ── Sofia Dec 2025 ────────────────────────────────────────────────────────────
// Table: Venue | Friday | Saturday  (day columns carry hours)
function parseSofiaDec(rows) {
  const places = [];
  const seen = new Set();

  let headerRow = -1;
  for (let r = 0; r < rows.length; r++) {
    if (String(rows[r][0] || '').toLowerCase().trim() === 'venue') {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) return places;

  // Map column index → weekday key
  const dayColMap = {};
  const header = rows[headerRow];
  for (let c = 1; c < header.length; c++) {
    const dk = dayKeyFromCell(header[c]);
    if (dk) dayColMap[c] = dk;
  }

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    const name = cleanName(row[0]);
    if (!name || isNonVenue(name)) continue;

    const openingHours = {};
    for (const [ci, dk] of Object.entries(dayColMap)) {
      const h = cellHours(row[parseInt(ci, 10)]);
      if (h) openingHours[dk] = h;
    }

    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    places.push({
      name, type: 'bar', city: 'Sofia', country: 'Bulgaria', address: '', openingHours,
    });
  }
  return places;
}

// ── Hebrew partial table (Bucharest, Krakow) ──────────────────────────────────
// col 0 = venue name; other cols have Hebrew day-name headers + hours cells.
function parseHebrewTable(rows, city, country) {
  const places = [];
  const seen = new Set();

  // Find header row: a row where at least one column starts with a Hebrew day name
  let headerRow = -1;
  outer:
  for (let r = 0; r < rows.length; r++) {
    for (let c = 1; c < rows[r].length; c++) {
      const cell = String(rows[r][c] || '').trim();
      for (const heb of Object.keys(HEB_DAY)) {
        if (cell.startsWith(heb)) { headerRow = r; break outer; }
      }
    }
  }
  if (headerRow < 0) return places;

  // Map col → weekday key (Hebrew cell may have date appended)
  const dayColMap = {};
  const header = rows[headerRow];
  for (let c = 1; c < header.length; c++) {
    const dk = dayKeyFromCell(header[c]);
    if (dk) dayColMap[c] = dk;
  }

  for (let r = headerRow + 1; r < rows.length; r++) {
    const row = rows[r];
    // FIX-2: venue names are in col 1, not col 0 (col 0 is blank in both Bucharest and Krakow+Warsaw)
    const raw0 = String(row[1] || '').trim();
    if (!raw0) continue;
    // Budget section: col 1 is a pure number → stop
    if (/^\d+$/.test(raw0)) break;

    const name = cleanName(raw0);
    if (!name || isNonVenue(name)) continue;

    const openingHours = {};
    for (const [ci, dk] of Object.entries(dayColMap)) {
      const h = cellHours(row[parseInt(ci, 10)]);
      if (h) openingHours[dk] = h;
    }

    const key = `${name.toLowerCase()}|${city.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    places.push({ name, type: 'bar', city, country, address: '', openingHours });
  }
  return places;
}

// ── Top-level parser ──────────────────────────────────────────────────────────

// Simple grid-only sheet config
const GRID_SHEETS = {
  'Krakow Nov 2025':   { city: 'Krakow',    country: 'Poland'   },
  'Barcelona Aug 2023':{ city: 'Barcelona', country: 'Spain'    },
  'Sofia Jul 2023':    { city: 'Sofia',     country: 'Bulgaria' },
  'Berlin Mar 2023':   { city: 'Berlin',    country: 'Germany'  },
  'Sofia Jan 2023':    { city: 'Sofia',     country: 'Bulgaria' },
  'Bucharest Nov 2022':{ city: 'Bucharest', country: 'Romania'  },
};

export function parseXlsxWorkbook(workbook) {
  const warnings = [];
  const allPlaces = [];
  // Global dedup: name|city (case-insensitive)
  const globalSeen = new Set();

  function push(list) {
    for (const p of list) {
      const key = `${p.name.toLowerCase()}|${p.city.toLowerCase()}`;
      if (globalSeen.has(key)) continue;
      globalSeen.add(key);
      allPlaces.push(p);
    }
  }

  function getRows(sheetName) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  }

  for (const name of workbook.SheetNames) {
    const rows = getRows(name);
    if (!rows || rows.length === 0) continue;

    if (name === 'Madrid Aug 2024') {
      push(parseMadrid(rows));

    } else if (name === 'Sofia Dec 2025') {
      push(parseSofiaDec(rows));

    } else if (name === 'Bucharest JUN 2024') {
      // Grid contains Krakow content (copy-paste error) — table only
      push(parseHebrewTable(rows, 'Bucharest', 'Romania'));

    } else if (name === 'Krakow + Warsaw Apr 2024') {
      // Table = Krakow venues; grid = Warsaw (city auto-detected by column scan)
      push(parseHebrewTable(rows, 'Krakow', 'Poland'));
      push(extractGrid(rows, 'Krakow', 'Poland'));

    } else if (name === 'Budapest Feb 2025') {
      // Table has blank Place column — fall back to grid
      warnings.push('Budapest: names from grid cells, verify manually');
      push(extractGrid(rows, 'Budapest', 'Hungary'));

    } else if (name.startsWith('Katowich + Krakow') || name.startsWith('Katowice + Krakow')) {
      // Multi-city: Katowice first, Krakow later — detected by column scan
      push(extractGrid(rows, 'Katowice', 'Poland'));

    } else if (GRID_SHEETS[name]) {
      const { city, country } = GRID_SHEETS[name];
      push(extractGrid(rows, city, country));
    }
    // Unknown sheets silently skipped
  }

  return { places: allPlaces, warnings };
}

// ── DEBUG EXPORT (temporary — remove before shipping) ─────────────────────────
// Returns every candidate token from every extraction path, tagged with source.
// { raw, cleaned, sheet, path, city, accepted }
// 'accepted' = true if it would make it into the final places list (passed cleanName + isNonVenue).
export function parseXlsxWorkbookDebug(workbook) {
  const candidates = [];

  function getRows(sheetName) {
    const ws = workbook.Sheets[sheetName];
    if (!ws) return null;
    return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  }

  function record(raw, sheet, path, city) {
    const cleaned = cleanName(raw);
    candidates.push({
      raw: raw.trim(),
      cleaned,
      sheet,
      path,
      city,
      accepted: !!cleaned && !isNonVenue(cleaned),
    });
  }

  function debugGrid(rows, sheet, defaultCity) {
    const maxCols = rows.reduce((mx, r) => Math.max(mx, r.length), 0);
    const colCity = new Array(maxCols).fill(defaultCity);
    for (let r = 0; r <= Math.min(9, rows.length - 1); r++) {
      const row = rows[r] || [];
      for (let c = 0; c < row.length; c++) {
        const cell = String(row[c] || '').toLowerCase();
        if (cell.includes('warsaw') || cell.includes('warszawa')) {
          for (let i = c; i < maxCols; i++) colCity[i] = 'Warsaw';
        } else if (cell.includes('krakow') || cell.includes('kraków')) {
          for (let i = c; i < maxCols; i++) colCity[i] = 'Krakow';
        } else if (cell.includes('katowice')) {
          for (let i = c; i < maxCols; i++) colCity[i] = 'Katowice';
        }
      }
    }
    for (let r = 3; r <= Math.min(9, rows.length - 1); r++) {
      for (let c = 0; c < (rows[r] || []).length; c++) {
        const raw = String(rows[r][c] || '').trim();
        if (!raw) continue;
        const city = colCity[c] || defaultCity;
        for (const token of raw.split(/\n/)) {
          if (!token.trim()) continue;
          record(token, sheet, 'extractGrid', city);
        }
      }
    }
  }

  function debugMadrid(rows) {
    let startRow = -1;
    for (let r = 0; r < rows.length; r++) {
      if (String(rows[r][1] || '').toLowerCase().trim() === 'place') { startRow = r + 1; break; }
    }
    if (startRow < 0) return;
    for (let r = startRow; r < rows.length; r++) {
      const raw = String(rows[r][1] || '').trim();
      if (raw) record(raw, 'Madrid Aug 2024', 'parseMadrid', 'Madrid');
    }
  }

  function debugSofiaDec(rows) {
    let headerRow = -1;
    for (let r = 0; r < rows.length; r++) {
      if (String(rows[r][0] || '').toLowerCase().trim() === 'venue') { headerRow = r; break; }
    }
    if (headerRow < 0) return;
    for (let r = headerRow + 1; r < rows.length; r++) {
      const raw = String(rows[r][0] || '').trim();
      if (raw) record(raw, 'Sofia Dec 2025', 'parseSofiaDec', 'Sofia');
    }
  }

  function debugHebrewTable(rows, sheet, city) {
    let headerRow = -1;
    outer:
    for (let r = 0; r < rows.length; r++) {
      for (let c = 1; c < rows[r].length; c++) {
        const cell = String(rows[r][c] || '').trim();
        for (const heb of Object.keys(HEB_DAY)) {
          if (cell.startsWith(heb)) { headerRow = r; break outer; }
        }
      }
    }
    if (headerRow < 0) return;
    for (let r = headerRow + 1; r < rows.length; r++) {
      // FIX-2: venue names in col 1, not col 0
      const raw = String(rows[r][1] || '').trim();
      if (!raw) continue;
      if (/^\d+$/.test(raw)) break;
      record(raw, sheet, 'parseHebrewTable', city);
    }
  }

  for (const name of workbook.SheetNames) {
    const rows = getRows(name);
    if (!rows || rows.length === 0) continue;

    if (name === 'Madrid Aug 2024') {
      debugMadrid(rows);
    } else if (name === 'Sofia Dec 2025') {
      debugSofiaDec(rows);
    } else if (name === 'Bucharest JUN 2024') {
      debugHebrewTable(rows, name, 'Bucharest');
    } else if (name === 'Krakow + Warsaw Apr 2024') {
      debugHebrewTable(rows, name, 'Krakow');
      debugGrid(rows, name, 'Krakow');
    } else if (name === 'Budapest Feb 2025') {
      debugGrid(rows, name, 'Budapest');
    } else if (name.startsWith('Katowich + Krakow') || name.startsWith('Katowice + Krakow')) {
      debugGrid(rows, name, 'Katowice');
    } else if (GRID_SHEETS[name]) {
      debugGrid(rows, name, GRID_SHEETS[name].city);
    }
  }

  return candidates;
}
