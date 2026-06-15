import { useEffect, useState } from 'react';
import { getScheduleForTrip, getAllPlaces, deleteScheduleItem } from '../db/repo.js';
import { BLOCKS } from '../db/constants.js';
import { daysInRange, formatDayHeader } from '../utils/dates.js';
import { generateDaySheet } from '../utils/exportHtml.js';
import SlotCell from './SlotCell.jsx';
import PlacePicker from './PlacePicker.jsx';
import './TripGrid.css';

export default function TripGrid({ trip, onBack }) {
  const [scheduleItems, setScheduleItems] = useState([]);
  const [places, setPlaces] = useState({}); // id → place, keyed for O(1) lookup
  const [picker, setPicker] = useState(null); // null | { date, block }

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

  function handlePickerConfirm() {
    setPicker(null);
    load();
  }

  function handleExport() {
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

  const days = (trip.startDate && trip.endDate)
    ? daysInRange(trip.startDate, trip.endDate)
    : [];

  // Accommodation names for the header strip — looked up from the places map.
  const accomNames = (trip.accommodationPlaceIds || [])
    .map((id) => places[id]?.name)
    .filter(Boolean);

  // Outbound flight → morning of startDate; inbound → morning of endDate.
  // Both can appear on the same day if trip is a single day.
  function flightCardsForSlot(date, blockKey) {
    if (blockKey !== 'morning') return [];
    const cards = [];
    if (date === trip.startDate && trip.outboundFlight) {
      cards.push({ direction: 'out', flight: trip.outboundFlight });
    }
    if (date === trip.endDate && trip.inboundFlight) {
      cards.push({ direction: 'in', flight: trip.inboundFlight });
    }
    return cards;
  }

  return (
    <div className="tg-root">

      {/* ── Header ── */}
      <div className="tg-header">
        <button className="tg-back" onClick={onBack}>← TRIPS</button>
        <h1 className="tg-title">{trip.title}</h1>
        {trip.cities?.length > 0 && (
          <span className="tg-cities">{trip.cities.join(' · ').toUpperCase()}</span>
        )}
        <button className="tg-export" onClick={handleExport}>EXPORT HTML</button>
      </div>

      {/* ── Accommodation strip (trip-level, not per-night cell) ── */}
      {accomNames.length > 0 && (
        <div className="tg-accom-strip">
          <span className="tg-accom-label">🏠 ACCOMMODATION</span>
          <span className="tg-accom-names">{accomNames.join(' · ')}</span>
        </div>
      )}

      {/* ── Day × block grid ── */}
      {days.length === 0 ? (
        <p className="tg-empty">No dates set — edit the trip to add start and end dates.</p>
      ) : (
        <div className="tg-days">
          {days.map((date) => (
            <div key={date} className="tg-day-col">
              <div className="tg-day-header">{formatDayHeader(date)}</div>
              {BLOCKS.map((block) => {
                const items = scheduleItems.filter(
                  (si) => si.date === date && si.block === block.key
                );
                return (
                  <SlotCell
                    key={block.key}
                    block={block}
                    items={items}
                    places={places}
                    flightCards={flightCardsForSlot(date, block.key)}
                    onAdd={() => setPicker({ date, block: block.key })}
                    onRemove={handleRemove}
                  />
                );
              })}
            </div>
          ))}
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
    </div>
  );
}
