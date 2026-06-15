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
  // Strip trailing hours patterns (e.g., "Venue Name 12:00-23:00")
  s = s.replace(/\s+\d{1,2}:\d{2}\s*[-–]\s*\d{1,2}:\d{2}.*$/, '');
  return s.trim();
}

function isNonVenue(s) {
  s = String(s).trim();
  if (!s || s.length < 3)         return true;
  if (HEBREW_RE.test(s))          return true;  // Hebrew text
  if (FLIGHT_RE.test(s))          return true;  // flight codes
  if (AIRPORT_RE.test(s))         return true;  // TLV, KRK, WAW
  if (/^\d/.test(s))              return true;  // starts with digit
  if (TRANSIT_RE.test(s))         return true;  // transit keywords
  if (/^\d{1,2}[./]\d{1,2}/.test(s)) return true; // date patterns
  return false;
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
        places.push({ name, type: 'other', city, country, address: '', openingHours: {} });
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
    const raw0 = String(row[0] || '').trim();
    if (!raw0) continue;
    // Budget section: first cell is a pure number → stop
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
