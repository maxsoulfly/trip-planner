import { typeMeta } from '../db/constants.js';
import './SlotCell.css';

export default function SlotCell({ block, items, places, flightCards, onAdd, onRemove }) {
  const sortedItems = items.slice().sort((a, b) => a.order - b.order);

  return (
    <div className="sc-root">
      <div className="sc-block-label">
        <span className="sc-block-emoji">{block.emoji}</span>
        {block.label.toUpperCase()}
      </div>

      {/* Static flight cards — from trip.outboundFlight / inboundFlight, not scheduleItems */}
      {flightCards.map((fc, i) => (
        <div key={i} className="sc-flight-card">
          <span className="sc-flight-badge">{fc.direction === 'out' ? 'OUT' : 'IN'}</span>
          <span className="sc-flight-route">
            ✈ {fc.flight.from}
            {fc.flight.depTime && ` ${fc.flight.depTime}`}
            {' → '}
            {fc.flight.to}
            {fc.flight.arrTime && ` ${fc.flight.arrTime}`}
          </span>
          {fc.flight.number && (
            <span className="sc-flight-num">{fc.flight.number}</span>
          )}
        </div>
      ))}

      {/* Scheduled items */}
      {sortedItems.map((item) => {
        if (item.kind === 'place') {
          const place = places[item.placeId];
          return (
            <div key={item.id} className="sc-item sc-item--place">
              <span className="sc-item-icon">{typeMeta(place?.type)?.emoji || '📍'}</span>
              <span className="sc-item-name">{place?.name || '(deleted)'}</span>
              {/* TODO: up/down reorder (polish step) */}
              <button className="sc-remove" onClick={() => onRemove(item.id)} aria-label="Remove">✕</button>
            </div>
          );
        }
        const kindIcon = item.kind === 'transport' ? '🚌' : '📝';
        return (
          <div key={item.id} className="sc-item sc-item--adhoc">
            <span className="sc-item-icon">{kindIcon}</span>
            <span className="sc-item-name">{item.adHoc?.label || '—'}</span>
            {/* TODO: up/down reorder (polish step) */}
            <button className="sc-remove" onClick={() => onRemove(item.id)} aria-label="Remove">✕</button>
          </div>
        );
      })}

      <button className="sc-add" onClick={onAdd}>+ ADD</button>
    </div>
  );
}
