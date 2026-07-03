import { useEffect, useState } from 'react';
import { getScheduleForTrip, getAllPlaces, deleteScheduleItem, putScheduleItem, addScheduleItem } from '../db/repo.js';
import { BLOCKS, PLACE_TYPES } from '../db/constants.js';
import { daysInRange, formatDayHeader } from '../utils/dates.js';
import { generateDaySheet } from '../utils/exportHtml.js';
import { exportTripXlsx } from '../utils/exportTripXlsx.js';
import { haversine } from '../utils/haversine.js';
import SlotCell from './SlotCell.jsx';
import PlacePicker from './PlacePicker.jsx';
import PlaceForm from './PlaceForm.jsx';
import TripXlsxImport from './TripXlsxImport.jsx';
import './TripGrid.css';

// Returns the block key whose time window contains the given HH:MM or H:MM AM/PM string.
function blockForTime(hhmm) {
  if (!hhmm) return 'morning';
  const ampm = hhmm.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  let h;
  if (ampm) {
    h = parseInt(ampm[1], 10);
    const isPM = ampm[3].toUpperCase() === 'PM';
    if (isPM && h !== 12) h += 12;
    if (!isPM && h === 12) h = 0;
  } else {
    h = parseInt(hhmm.split(':')[0], 10);
  }
  for (const block of BLOCKS) {
    if (block.start === null) continue; // night stay — no time window
    if (block.start < block.end) {
      if (h >= block.start && h < block.end) return block.key;
    } else {
      if (h >= block.start || h < block.end) return block.key;
    }
  }
  return 'morning';
}

function timeToMins(hhmm) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export default function TripGrid({ trip, onBack }) {
  const [scheduleItems,  setScheduleItems]  = useState([]);
  const [places,         setPlaces]         = useState({}); // id → place
  const [picker,         setPicker]         = useState(null);  // null | { date, block }
  const [editingPlace,   setEditingPlace]   = useState(null);  // null | Place
  const [showXlsxImport, setShowXlsxImport] = useState(false);
  const [suggestions,    setSuggestions]    = useState(null);
  // { date, block, candidates: [{place, dist, hoursScore}], anchor }

  async function load() {
    const [items, allPlaces] = await Promise.all([
      getScheduleForTrip(trip.id),
      getAllPlaces(),
    ]);
    setScheduleItems(items);
    const map = {};
    allPlaces.forEach((p) => { map[p.id] = p; });
    setPlaces(map);
  }

  useEffect(() => { load(); }, [trip.id]);

  async function handleRemove(itemId) {
    await deleteScheduleItem(itemId);
    load();
  }

  async function handleMoveItem(item, direction) {
    const slotItems = scheduleItems
      .filter((si) => si.date === item.date && si.block === item.block)
      .sort((a, b) => a.order - b.order);
    const idx     = slotItems.findIndex((si) => si.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= slotItems.length) return;
    await putScheduleItem({ ...slotItems[idx],     order: swapIdx });
    await putScheduleItem({ ...slotItems[swapIdx], order: idx    });
    load();
  }

  function handlePickerConfirm() {
    setPicker(null);
    load();
  }

  function handlePlaceSaved() {
    setEditingPlace(null);
    load();
  }

  function handleExportHtml() {
    const html = generateDaySheet(trip, scheduleItems, places);
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = trip.title.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() + '.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleExportXlsx() {
    exportTripXlsx(trip, scheduleItems, places);
  }

  // ── Nearby suggest ────────────────────────────────────────────────────────

  function handleSuggestNearby(date, block) {
    const slotItems = scheduleItems.filter(
      si => si.date === date && si.block === block.key && si.placeId && places[si.placeId]?.lat
    );
    const dayItems = scheduleItems.filter(
      si => si.date === date && si.placeId && places[si.placeId]?.lat
    );
    const anchor = slotItems.length
      ? places[slotItems[0].placeId]   // prefer anchor from same slot
      : dayItems.length
        ? places[dayItems[0].placeId]  // fall back to any place on the day
        : null;

    if (!anchor) {
      setPicker({ date, block: block.key });
      return;
    }

    const weekday = ['sun','mon','tue','wed','thu','fri','sat'][
      new Date(date + 'T12:00:00').getDay()
    ];

    const usedIds = new Set(
      scheduleItems.filter(si => si.date === date).map(si => si.placeId).filter(Boolean)
    );

    const PRIMARY_RADIUS = 0.8;   // 800m — 10 min walk
    const FALLBACK_RADIUS = 1.5;  // expand if fewer than 3 results

    const scored = Object.values(places)
      .filter(p =>
        p.lat && p.lng &&
        !usedIds.has(p.id) &&
        p.status !== 'permanently_closed'
      )
      .map(p => {
        if (block.start === null) return null; // night stay has no time window — skip scoring
        const dist = haversine(anchor.lat, anchor.lng, p.lat, p.lng);
        const dayHours = p.openingHours?.[weekday];
        if (dayHours === null) return null; // explicitly closed

        let hoursScore = 0;
        if (dayHours) {
          const openMins   = timeToMins(dayHours.open);
          const closeMins  = dayHours.close === '00:00' ? 1440 : timeToMins(dayHours.close);
          const blockStart = block.start * 60;
          const blockEnd   = block.end === 0 ? 1440 : (block.end < block.start ? block.end * 60 + 1440 : block.end * 60);
          if (openMins <= blockStart && closeMins >= blockEnd) hoursScore = 2;
          else if (openMins < blockEnd && closeMins > blockStart) hoursScore = 1;
          else return null; // closed during this block
        }
        // dayHours === undefined → unknown hours, hoursScore = 0, include at lower rank

        return { place: p, dist, hoursScore };
      })
      .filter(Boolean);

    let candidates = scored.filter(c => c.dist <= PRIMARY_RADIUS);
    if (candidates.length < 3) {
      candidates = scored.filter(c => c.dist <= FALLBACK_RADIUS);
    }
    candidates = candidates
      .sort((a, b) => b.hoursScore - a.hoursScore || a.dist - b.dist)
      .slice(0, 8);

    const radiusUsed = candidates.some(c => c.dist > PRIMARY_RADIUS) ? '1.5km' : '800m';

    setSuggestions({ date, block: block.key, candidates, anchor, radiusUsed });
  }

  async function handleAddSuggestion(date, blockKey, placeId) {
    await addScheduleItem({ tripId: trip.id, date, block: blockKey,
      kind: 'place', placeId, order: 0 });
    setSuggestions(null);
    await load();
  }

  // ── Derived flight block positions ────────────────────────────────────────

  const outboundBlock = trip.outboundFlight?.depTime
    ? blockForTime(trip.outboundFlight.depTime)
    : 'morning';

  const inboundBlock = trip.inboundFlight?.depTime
    ? blockForTime(trip.inboundFlight.depTime)
    : 'morning';

  function flightCardsForSlot(date, blockKey) {
    const cards = [];
    const outDepDate = trip.outboundFlight?.depDate || trip.startDate;
    if (date === outDepDate && trip.outboundFlight && blockKey === outboundBlock) {
      cards.push({ direction: 'in', flight: trip.outboundFlight });
    }
    const inDepDate = trip.inboundFlight?.depDate || trip.endDate;
    if (date === inDepDate && trip.inboundFlight && blockKey === inboundBlock) {
      cards.push({ direction: 'out', flight: trip.inboundFlight });
    }
    return cards;
  }

  // Extend grid to inbound arrival date if it falls after endDate (e.g. overnight flight).
  const gridEndDate = (() => {
    const end = trip.endDate || '';
    const arrDate = trip.inboundFlight?.arrDate || '';
    if (!arrDate) return end;
    return arrDate > end ? arrDate : end;
  })();

  const days = (trip.startDate && gridEndDate)
    ? daysInRange(trip.startDate, gridEndDate)
    : [];

  return (
    <div className="tg-root">

      {/* ── Header ── */}
      <div className="tg-header">
        <button className="tg-back" onClick={onBack}>← TRIPS</button>
        <h1 className="tg-title">{trip.title}</h1>
        {trip.cities?.length > 0 && (
          <span className="tg-cities">{trip.cities.join(' · ').toUpperCase()}</span>
        )}
        <div className="tg-toolbar">
          <button className="tg-toolbar-btn" onClick={handleExportHtml}>EXPORT HTML</button>
          <button className="tg-toolbar-btn" onClick={handleExportXlsx}>EXPORT XLSX</button>
          <button className="tg-toolbar-btn" onClick={() => setShowXlsxImport(true)}>IMPORT XLSX</button>
        </div>
      </div>

      {/* ── Day × block grid ── */}
      {days.length === 0 ? (
        <p className="tg-empty">No dates set — edit the trip to add start and end dates.</p>
      ) : (
        <div className="tg-days">
          {days.map((date) => {
            // Greying uses flight dates; falls back to trip start/end for old records.
            const outArrDate = trip.outboundFlight?.arrDate || trip.startDate;
            const inDepDate  = trip.inboundFlight?.depDate  || trip.endDate;

            const isArrivalDay   = date === outArrDate && trip.outboundFlight?.arrTime;
            const isDepartureDay = date === inDepDate  && trip.inboundFlight?.depTime;

            const arrBlock = isArrivalDay
              ? BLOCKS.find(b => b.key === blockForTime(trip.outboundFlight.arrTime))
              : null;

            const depBlock = isDepartureDay
              ? BLOCKS.find(b => b.key === blockForTime(trip.inboundFlight.depTime))
              : null;

            return (
              <div key={date} className="tg-day-col">
                <div className="tg-day-header">{formatDayHeader(date)}</div>
                {BLOCKS.map((block) => {
                  const items = scheduleItems.filter(
                    (si) => si.date === date && si.block === block.key
                  );
                  const dimmed =
                    (arrBlock && block.order < arrBlock.order) ||
                    (depBlock && block.order > depBlock.order);
                  return (
                    <SlotCell
                      key={block.key}
                      block={block}
                      items={items}
                      places={places}
                      flightCards={flightCardsForSlot(date, block.key)}
                      dimmed={dimmed}
                      onAdd={() => setPicker({ date, block: block.key })}
                      onRemove={handleRemove}
                      onMoveUp={(item) => handleMoveItem(item, 'up')}
                      onMoveDown={(item) => handleMoveItem(item, 'down')}
                      onEditPlace={(place) => setEditingPlace(place)}
                      onSuggestNearby={() => handleSuggestNearby(date, block)}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Nearby suggest panel (fixed bottom-right) ── */}
      {suggestions && (
        <div className="tg-suggest-panel">
          <div className="tg-suggest-header">
            <span className="tg-suggest-title">
              NEARBY · {suggestions.block.toUpperCase().replace('_',' ')} · {suggestions.radiusUsed}
            </span>
            <button className="tg-suggest-close" onClick={() => setSuggestions(null)}>✕</button>
          </div>
          <div className="tg-suggest-list">
            {suggestions.candidates.length === 0 && (
              <p className="tg-suggest-empty">No nearby places with coords found.</p>
            )}
            {suggestions.candidates.map(({ place, dist, hoursScore }) => (
              <button
                key={place.id}
                className="tg-suggest-item"
                onClick={() => handleAddSuggestion(suggestions.date, suggestions.block, place.id)}
              >
                <span className="tg-suggest-emoji">
                  {PLACE_TYPES.find(t => t.key === place.type)?.emoji || '📍'}
                </span>
                <span className="tg-suggest-name">{place.name}</span>
                <span className="tg-suggest-dist">{dist.toFixed(1)} km</span>
                {hoursScore === 0 &&
                  <span className="tg-suggest-warn">hrs unknown</span>}
              </button>
            ))}
          </div>
          <button
            className="tg-suggest-picker"
            onClick={() => { setSuggestions(null); setPicker({ date: suggestions.date, block: suggestions.block }); }}
          >
            ◈ OPEN FULL PICKER
          </button>
        </div>
      )}

      {/* ── Place picker modal ── */}
      {picker && (
        <PlacePicker
          date={picker.date}
          block={picker.block}
          trip={trip}
          places={places}
          onConfirm={handlePickerConfirm}
          onClose={() => setPicker(null)}
        />
      )}

      {/* ── Edit place modal (click-to-edit from grid) ── */}
      {editingPlace && (
        <PlaceForm
          initialData={editingPlace}
          onSave={handlePlaceSaved}
          onClose={() => setEditingPlace(null)}
        />
      )}

      {/* ── XLSX import modal ── */}
      {showXlsxImport && (
        <TripXlsxImport
          trip={trip}
          onDone={() => { setShowXlsxImport(false); load(); }}
          onClose={() => setShowXlsxImport(false)}
        />
      )}
    </div>
  );
}
