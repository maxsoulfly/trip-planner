import { useState } from 'react';
import { daysInRange } from '../utils/dates.js';
import './TripList.css';

function TripCard({ trip, onOpen, onEdit, onDelete }) {
  const [confirming, setConfirming] = useState(false);

  const dayCount = (trip.startDate && trip.endDate)
    ? daysInRange(trip.startDate, trip.endDate).length
    : null;

  return (
    <article className="trip-card">
      <span className="trip-card-corner" aria-hidden="true" />

      <div className="trip-eyebrow">TRIP</div>
      <h2 className="trip-title">{trip.title || '(untitled)'}</h2>

      {trip.cities?.length > 0 && (
        <div className="trip-cities">{trip.cities.join(' · ').toUpperCase()}</div>
      )}

      {trip.startDate && trip.endDate && (
        <div className="trip-dates">
          {trip.startDate} → {trip.endDate}
          {dayCount != null && <span className="trip-days"> · {dayCount} {dayCount === 1 ? 'DAY' : 'DAYS'}</span>}
        </div>
      )}

      {trip.outboundFlight && (
        <div className="trip-flight">
          ✈ OUT &nbsp;{trip.outboundFlight.from} {trip.outboundFlight.depTime} → {trip.outboundFlight.to} {trip.outboundFlight.arrTime}
          {trip.outboundFlight.number && <span> · {trip.outboundFlight.number}</span>}
        </div>
      )}
      {trip.inboundFlight && (
        <div className="trip-flight">
          ✈ IN &nbsp;&nbsp;{trip.inboundFlight.from} {trip.inboundFlight.depTime} → {trip.inboundFlight.to} {trip.inboundFlight.arrTime}
          {trip.inboundFlight.number && <span> · {trip.inboundFlight.number}</span>}
        </div>
      )}

      <div className="trip-actions">
        <button className="trip-btn-open" onClick={() => onOpen(trip)}>OPEN GRID</button>
        <button className="trip-btn-ghost" onClick={() => onEdit(trip)}>EDIT</button>
        {confirming ? (
          <span className="trip-confirm-row">
            <span className="trip-confirm-label">REALLY?</span>
            <button className="trip-btn-ghost trip-btn-confirm" onClick={() => onDelete(trip)}>CONFIRM</button>
            <button className="trip-btn-ghost" onClick={() => setConfirming(false)}>CANCEL</button>
          </span>
        ) : (
          <button
            className="trip-btn-ghost trip-btn-danger"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${trip.title}`}
          >
            DEL
          </button>
        )}
      </div>
    </article>
  );
}

export default function TripList({ trips, onNew, onEdit, onDelete, onOpen }) {
  const sorted = [...trips].sort((a, b) => {
    if (!a.startDate && !b.startDate) return 0;
    if (!a.startDate) return 1;
    if (!b.startDate) return -1;
    return a.startDate.localeCompare(b.startDate);
  });

  return (
    <div className="trips-view">
      <div className="trips-head">
        <span className="trips-mark">TRIPS<span className="trips-slash">//</span></span>
        <span className="trips-sub">trip planning · all cities</span>
      </div>

      <div className="trips-toolbar">
        <button className="btn-add" onClick={onNew}>+ NEW TRIP</button>
      </div>

      {sorted.length === 0 ? (
        <p className="trips-empty">No trips yet — plan your first expedition.</p>
      ) : (
        <div className="trips-grid">
          {sorted.map((t) => (
            <TripCard
              key={t.id}
              trip={t}
              onOpen={onOpen}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
