import { BLOCKS, PLACE_TYPES } from '../db/constants.js';
import { daysInRange, formatDayHeader } from './dates.js';
import { weekdayKeyFromDate, hoursForDay } from './hours.js';

const TYPE_EMOJI = Object.fromEntries(PLACE_TYPES.map((t) => [t.key, t.emoji]));

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function mapsUrl(place) {
  if (place.googleMapsUrl) return place.googleMapsUrl;
  if (place.lat && place.lng) return `https://www.google.com/maps?q=${place.lat},${place.lng}`;
  if (place.address) return `https://www.google.com/maps/search/?q=${encodeURIComponent(place.address)}`;
  return null;
}

function hoursSpan(openingHours, weekdayKey) {
  const h = hoursForDay(openingHours, weekdayKey);
  if (h === 'Closed') return `<span class="hours hours--closed">CLOSED</span>`;
  if (h === '—')      return `<span class="hours hours--unknown">—</span>`;
  return `<span class="hours hours--open">${esc(h)}</span>`;
}

function renderFlight(direction, flight) {
  if (!flight) return '';
  const route = [flight.from, flight.depTime, '→', flight.to, flight.arrTime]
    .filter(Boolean).join(' ');
  const num = [flight.airline, flight.number].filter(Boolean).join(' ');
  return `
  <div class="flight-card">
    <span class="flight-badge">${direction === 'out' ? 'OUT' : 'IN'}</span>
    <span class="flight-route">✈ ${esc(route)}${num ? ` · ${esc(num)}` : ''}</span>
  </div>`;
}

function renderPlace(place, weekdayKey) {
  const url   = mapsUrl(place);
  const emoji = TYPE_EMOJI[place.type] || '📍';
  const btn   = url
    ? `<a href="${esc(url)}" class="maps-btn" target="_blank" rel="noopener">Open in Maps ↗</a>`
    : '';
  return `
  <div class="place-card">
    <div class="place-header">
      <span class="place-icon">${emoji}</span>
      <span class="place-name">${esc(place.name)}</span>
      ${hoursSpan(place.openingHours, weekdayKey)}
    </div>${btn}
  </div>`;
}

function renderAdHoc(item) {
  const icon  = item.kind === 'transport' ? '🚌' : '📝';
  const label = item.adHoc?.label || '—';
  return `
  <div class="adhoc-item">
    <span class="adhoc-icon">${icon}</span>
    <span class="adhoc-label">${esc(label)}</span>
  </div>`;
}

function renderBlock(block, blockItems, placesMap, weekdayKey, flightCards) {
  const placeItems = blockItems.filter((i) => i.kind === 'place');
  const adhocItems = blockItems.filter((i) => i.kind !== 'place');
  if (!flightCards.length && !placeItems.length && !adhocItems.length) return '';

  const sorted = (arr) => arr.slice().sort((a, b) => a.order - b.order);

  const inner = [
    ...flightCards.map(({ direction, flight }) => renderFlight(direction, flight)),
    ...sorted(placeItems).map(({ placeId }) => {
      const p = placesMap[placeId];
      return p ? renderPlace(p, weekdayKey) : '';
    }),
    ...sorted(adhocItems).map(renderAdHoc),
  ].join('');

  return `
  <div class="block">
    <div class="block-label">${block.emoji} ${block.label.toUpperCase()}</div>
    ${inner}
  </div>`;
}

function renderDay(date, allItems, placesMap, trip) {
  const weekdayKey = weekdayKeyFromDate(date);
  const dayItems   = allItems.filter((i) => i.date === date);

  const blocksHtml = BLOCKS.map((block) => {
    const flightCards = [];
    if (block.key === 'morning') {
      if (date === trip.startDate && trip.outboundFlight) {
        flightCards.push({ direction: 'out', flight: trip.outboundFlight });
      }
      if (date === trip.endDate && trip.inboundFlight) {
        flightCards.push({ direction: 'in', flight: trip.inboundFlight });
      }
    }
    return renderBlock(
      block,
      dayItems.filter((i) => i.block === block.key),
      placesMap,
      weekdayKey,
      flightCards,
    );
  }).join('');

  const body = blocksHtml.trim() || '<p class="day-empty">Nothing scheduled.</p>';

  return `
<section class="day">
  <h2 class="day-heading">${esc(formatDayHeader(date))}</h2>
  ${body}
</section>`;
}

function buildCss() {
  return `
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
#tt { display: none; }
body { background: #0E0E0F; }

#content {
  --bg: #0E0E0F;
  --panel: #161518;
  --panel2: #1E1C20;
  --line: #2C2A2E;
  --ink: #E7E1D4;
  --dim: #948C80;
  --amber: #FFB000;
  --rust: #CC4B2E;
  --steel: #74808C;

  background: var(--bg);
  color: var(--ink);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 15px;
  line-height: 1.5;
  min-height: 100vh;
  max-width: 600px;
  margin: 0 auto;
  padding: 16px 16px 80px;
}

#tt:checked + #content {
  --bg: #E7E0D0;
  --panel: #F1EBDC;
  --panel2: #E2DAC6;
  --line: #C5B99E;
  --ink: #211D15;
  --dim: #6B6354;
  --amber: #9C5A12;
  --rust: #9A2E15;
  --steel: #5A6066;
}

/* ─── Header ─── */
.sheet-header { margin-bottom: 20px; }
.sheet-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.tt-btn {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .1em;
  color: var(--dim);
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 5px 10px;
  cursor: pointer;
  user-select: none;
  background: transparent;
}
.tt-label-light { display: none; }
#tt:checked + #content .tt-label-dark  { display: none; }
#tt:checked + #content .tt-label-light { display: inline; }
.sheet-generated {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 10px;
  color: var(--dim);
  letter-spacing: .06em;
}
.sheet-title {
  font-size: 22px;
  font-weight: 700;
  color: var(--ink);
  line-height: 1.2;
  margin-bottom: 4px;
}
.sheet-meta {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 11px;
  color: var(--dim);
  letter-spacing: .08em;
}

/* ─── Accommodation strip ─── */
.accom-strip {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  padding: 10px 12px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.accom-label {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .14em;
  color: var(--steel);
}
.accom-link {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 13px;
  color: var(--amber);
  text-decoration: none;
}
.accom-link:hover { text-decoration: underline; }
.accom-name-plain {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 13px;
  color: var(--ink);
}

/* ─── Day section ─── */
.day {
  border-top: 1px dashed var(--line);
  padding-top: 14px;
  margin-bottom: 24px;
}
.day-heading {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: .14em;
  color: var(--amber);
  text-transform: uppercase;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--amber);
  margin-bottom: 12px;
}
.day-empty {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 11px;
  color: var(--dim);
  letter-spacing: .06em;
}

/* ─── Block ─── */
.block { margin-bottom: 12px; }
.block-label {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: .16em;
  color: var(--steel);
  margin-bottom: 6px;
}

/* ─── Flight card ─── */
.flight-card {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel2);
  border: 1px solid var(--steel);
  border-radius: 6px;
  padding: 9px 12px;
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.flight-badge {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: .1em;
  color: var(--steel);
  border: 1px solid var(--steel);
  border-radius: 3px;
  padding: 2px 5px;
  flex-shrink: 0;
}
.flight-route {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 12px;
  color: var(--ink);
  letter-spacing: .04em;
}

/* ─── Place card ─── */
.place-card {
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 8px;
}
.place-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  flex-wrap: wrap;
}
.place-icon { font-size: 16px; line-height: 1; flex-shrink: 0; }
.place-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--ink);
  flex: 1;
  min-width: 0;
}
.hours {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.hours--open    { color: var(--amber); }
.hours--closed  { color: var(--rust); }
.hours--unknown { color: var(--dim); }
.maps-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--amber);
  color: var(--bg);
  text-decoration: none;
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: .1em;
  min-height: 48px;
  border-top: 1px solid var(--line);
}
.maps-btn:active { opacity: .8; }

/* ─── Ad-hoc item ─── */
.adhoc-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  background: var(--panel);
  border: 1px solid var(--line);
  border-radius: 6px;
  margin-bottom: 6px;
}
.adhoc-icon { font-size: 14px; flex-shrink: 0; }
.adhoc-label {
  font-family: ui-monospace, 'Courier New', monospace;
  font-size: 12px;
  color: var(--dim);
}
`.trim();
}

// Pure function — no React, no Dexie. Returns an HTML string ready to write to a file.
// trip:          Trip record from the DB
// scheduleItems: all ScheduleItems for this trip (from getScheduleForTrip)
// placesMap:     id → Place map (from getAllPlaces, keyed in TripGrid)
export function generateDaySheet(trip, scheduleItems, placesMap) {
  const days      = (trip.startDate && trip.endDate)
    ? daysInRange(trip.startDate, trip.endDate)
    : [];
  const generated = new Date().toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  });

  // Accommodation strip — shown once at the top, not per night cell
  const accomPlaces = (trip.accommodationPlaceIds || [])
    .map((id) => placesMap[id]).filter(Boolean);
  const accomHtml = accomPlaces.length > 0
    ? `<div class="accom-strip">
  <span class="accom-label">🏠 ACCOMMODATION</span>
  ${accomPlaces.map((p) => {
    const url = mapsUrl(p);
    return url
      ? `<a href="${esc(url)}" class="accom-link" target="_blank" rel="noopener">${esc(p.name)}</a>`
      : `<span class="accom-name-plain">${esc(p.name)}</span>`;
  }).join('\n  ')}
</div>`
    : '';

  // Trip meta line
  const nights    = days.length;
  const citiesStr = trip.cities?.length > 0 ? ` · ${trip.cities.join(' · ')}` : '';
  const metaStr   = days.length > 0
    ? `${trip.startDate} → ${trip.endDate} · ${nights} ${nights === 1 ? 'day' : 'days'}${citiesStr}`
    : citiesStr.replace(/^ · /, '');

  const daysHtml = days.map((date) => renderDay(date, scheduleItems, placesMap, trip)).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(trip.title)} — Day Sheet</title>
<style>
${buildCss()}
</style>
</head>
<body>
<input type="checkbox" id="tt">
<div id="content">
  <header class="sheet-header">
    <div class="sheet-topbar">
      <label for="tt" class="tt-btn">
        <span class="tt-label-dark">☀ LIGHT</span>
        <span class="tt-label-light">◐ DARK</span>
      </label>
      <span class="sheet-generated">generated ${esc(generated)}</span>
    </div>
    <h1 class="sheet-title">${esc(trip.title)}</h1>
    <p class="sheet-meta">${esc(metaStr)}</p>
  </header>
  ${accomHtml}
  ${daysHtml}
</div>
</body>
</html>`;
}
