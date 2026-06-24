// Pure flight email parser — no React, no Dexie.
// Primary target: Wizzair booking email format.
// Falls back to a generic token scan for other airlines (best-effort).

const AIRLINE_PREFIX_MAP = {
  W6: 'Wizz Air', FR: 'Ryanair', VY: 'Vueling',
  U2: 'easyJet', LY: 'El Al', '6H': 'Israir', IZ: 'Arkia',
};

// "Flight Number: W6 4428" — structured label present in Wizzair + many carriers.
const FLIGHT_NUM_LABELED = /Flight\s+Number[:\s]+([A-Z0-9]{1,3}\s?\d{3,4})/i;
// Bare airline-code + flight-number token for the generic fallback pass.
// Matches W6 4428, FR1234, LY317, U2 4181 but not IATA city codes (3-letter).
const FLIGHT_NUM_BARE = /\b([A-Z]{1,2}[0-9]?)\s?(\d{3,4})\b/;
// Route: City (IATA)   City (IATA) — columns may be separated by many spaces.
const ROUTE_RE = /([A-Z][^(]{0,30}?)\s*\(([A-Z]{3})\)\s+([A-Z][^(]{0,30}?)\s*\(([A-Z]{3})\)/;
// Two DD/MM/YYYY HH:MM pairs on one line (departure then arrival).
const DATETIME_PAIR_RE = /(\d{2}\/\d{2}\/\d{4})\s+(\d{2}:\d{2})\s+\d{2}\/\d{2}\/\d{4}\s+(\d{2}:\d{2})/;
// ISO date fallback for the generic pass.
const DATE_ISO_RE = /\b(\d{4}-\d{2}-\d{2})\b/;

function parseDDMMYYYY(str) {
  const m = str.match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// IATA airline designator is always 2 chars; strip space and take first two.
function prefixToAirline(flightNumber) {
  const prefix = flightNumber.replace(/\s+/g, '').slice(0, 2).toUpperCase();
  return AIRLINE_PREFIX_MAP[prefix] || '';
}

function emptyLeg() {
  return { airline: '', number: '', from: '', to: '', depTime: '', arrTime: '', date: null };
}

function buildFlight(leg) {
  if (!leg || (!leg.number && !leg.from)) return null;
  const { airline, number, from, to, depTime, arrTime } = leg;
  return { airline, number, from, to, depTime, arrTime };
}

function applyLineToLeg(line, leg) {
  if (!leg.number) {
    const m = line.match(FLIGHT_NUM_LABELED);
    if (m) { leg.number = m[1].trim(); leg.airline = prefixToAirline(leg.number); }
  }
  if (!leg.from) {
    const m = line.match(ROUTE_RE);
    if (m) { leg.from = m[2]; leg.to = m[4]; }
  }
  if (!leg.depTime) {
    const m = line.match(DATETIME_PAIR_RE);
    if (m) { leg.date = parseDDMMYYYY(m[1]); leg.depTime = m[2]; leg.arrTime = m[3]; }
  }
}

// Structured pass — uses "GOING OUT" / "COMING BACK" section markers (Wizzair)
// or "Flight Number:" labels to assign data to the correct leg.
function parseStructured(lines) {
  const legs = { outbound: emptyLeg(), inbound: emptyLeg() };
  let current = null;

  for (const line of lines) {
    if (/GOING\s+OUT/i.test(line))   current = 'outbound';
    if (/COMING\s+BACK/i.test(line)) current = 'inbound';

    // No markers seen yet — use "Flight Number:" label order to assign legs.
    if (current === null && FLIGHT_NUM_LABELED.test(line)) {
      current = !legs.outbound.number ? 'outbound' : 'inbound';
    }
    // In outbound with a number already set; new different "Flight Number:" → inbound.
    if (current === 'outbound' && legs.outbound.number) {
      const m = line.match(FLIGHT_NUM_LABELED);
      if (m && m[1].trim() !== legs.outbound.number) current = 'inbound';
    }

    if (current === null) continue;
    applyLineToLeg(line, legs[current]);
  }

  return {
    outbound:  buildFlight(legs.outbound),
    inbound:   buildFlight(legs.inbound),
    startDate: legs.outbound.date,
    endDate:   legs.inbound.date,
  };
}

// Generic fallback — finds bare flight-number tokens and looks for route + datetime
// within the next few lines. Best-effort; won't be perfect for all airline formats.
function parseGeneric(lines) {
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(FLIGHT_NUM_BARE);
    if (m) {
      const fn = `${m[1]} ${m[2]}`.trim();
      if (!hits.some(h => h.fn === fn)) hits.push({ idx: i, fn });
    }
  }
  if (!hits.length) {
    return { outbound: null, inbound: null, startDate: null, endDate: null };
  }

  function extractAround(startIdx) {
    const window = lines.slice(startIdx, startIdx + 6);
    const leg = emptyLeg();
    for (const l of window) {
      if (!leg.from) {
        const r = l.match(ROUTE_RE);
        if (r) { leg.from = r[2]; leg.to = r[4]; }
      }
      if (!leg.depTime) {
        const d = l.match(DATETIME_PAIR_RE);
        if (d) { leg.date = parseDDMMYYYY(d[1]); leg.depTime = d[2]; leg.arrTime = d[3]; }
      }
      if (!leg.date) {
        const iso = l.match(DATE_ISO_RE);
        const times = [...l.matchAll(/\b(\d{2}:\d{2})\b/g)].map(tm => tm[1]);
        if (iso && times.length) {
          leg.date = iso[1]; leg.depTime = times[0]; leg.arrTime = times[1] || '';
        }
      }
    }
    return leg;
  }

  function makeLeg(hit) {
    const parts = extractAround(hit.idx);
    return { number: hit.fn, airline: prefixToAirline(hit.fn), ...parts };
  }

  const outLeg = makeLeg(hits[0]);
  const inbLeg = hits.length > 1 ? makeLeg(hits[1]) : null;

  return {
    outbound:  buildFlight(outLeg),
    inbound:   inbLeg ? buildFlight(inbLeg) : null,
    startDate: outLeg.date,
    endDate:   inbLeg?.date || null,
  };
}

export function parseFlightEmail(text) {
  if (!text?.trim()) {
    return { outbound: null, inbound: null, startDate: null, endDate: null };
  }
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const structured = parseStructured(lines);
  if (structured.outbound || structured.inbound) return structured;
  return parseGeneric(lines);
}
