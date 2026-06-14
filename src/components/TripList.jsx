import { daysInRange } from '../utils/dates.js';
import './TripList.css';

function TripCard({ trip, onOpen, onEdit, onDelete }) {
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
        <button className="trip-btn-ghost trip-btn-danger" onClick={() => onDelete(trip)}>DEL</button>
      </div>
    </article>
  );
}

export default function TripList({ trips, onNew, onEdit, onDelete, onOpen }) {
  return (
    <div className="trips-view">
      <div className="trips-head">
        <span className="trips-mark">TRIPS<span className="trips-slash">//</span></span>
        <span className="trips-sub">trip planning · all cities</span>
      </div>

      <div className="trips-toolbar">
        <button className="btn-add" onClick={onNew}>+ NEW TRIP</button>
      </div>

      {trips.length === 0 ? (
        <p className="trips-empty">No trips yet — plan your first expedition.</p>
      ) : (
        <div className="trips-grid">
          {trips.map((t) => (
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
