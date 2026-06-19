import { useEffect, useState } from 'react';
import { getScheduleForTrip, getAllPlaces, deleteScheduleItem, putScheduleItem } from '../db/repo.js';
import { BLOCKS } from '../db/constants.js';
import { daysInRange, formatDayHeader } from '../utils/dates.js';
import { generateDaySheet } from '../utils/exportHtml.js';
import { exportTripXlsx } from '../utils/exportTripXlsx.js';
import SlotCell from './SlotCell.jsx';
import PlacePicker from './PlacePicker.jsx';
import PlaceForm from './PlaceForm.jsx';
import TripXlsxImport from './TripXlsxImport.jsx';
import './TripGrid.css';

export default function TripGrid({ trip, onBack }) {
  const [scheduleItems,  setScheduleItems]  = useState([]);
  const [places,         setPlaces]         = useState({}); // id → place
  const [picker,         setPicker]         = useState(null);  // null | { date, block }
  const [editingPlace,   setEditingPlace]   = useState(null);  // null | Place
  const [showXlsxImport, setShowXlsxImport] = useState(false);

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

  const days = (trip.startDate && trip.endDate)
    ? daysInRange(trip.startDate, trip.endDate)
    : [];

  // Outbound flight → morning of startDate; inbound → morning of endDate.
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
                    onMoveUp={(item) => handleMoveItem(item, 'up')}
                    onMoveDown={(item) => handleMoveItem(item, 'down')}
                    onEditPlace={(place) => setEditingPlace(place)}
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
