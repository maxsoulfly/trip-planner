import { typeMeta } from '../db/constants.js';
import './SlotCell.css';

export default function SlotCell({ block, items, places, flightCards, dimmed, onAdd, onRemove, onMoveUp, onMoveDown, onEditPlace, onSuggestNearby }) {
  const sortedItems = items.slice().sort((a, b) => a.order - b.order);

  return (
    <div className={`sc-root${dimmed ? ' sc-root--dimmed' : ''}`}>
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
      {sortedItems.map((item, idx) => {
        const isFirst = idx === 0;
        const isLast  = idx === sortedItems.length - 1;

        if (item.kind === 'place') {
          const place = places[item.placeId];
          return (
            <div key={item.id} className="sc-item sc-item--place">
              <span className="sc-item-icon">{typeMeta(place?.type)?.emoji || '📍'}</span>
              {place && onEditPlace ? (
                <button
                  className="sc-item-name sc-item-name--link"
                  onClick={() => onEditPlace(place)}
                  title={`Edit ${place.name}`}
                >{place.name}</button>
              ) : (
                <span className="sc-item-name">{place?.name || '(deleted)'}</span>
              )}
              <span className="sc-item-controls">
                <button
                  className="sc-move-btn"
                  onClick={() => onMoveUp(item)}
                  disabled={isFirst}
                  aria-label="Move up"
                >↑</button>
                <button
                  className="sc-move-btn"
                  onClick={() => onMoveDown(item)}
                  disabled={isLast}
                  aria-label="Move down"
                >↓</button>
              </span>
              <button className="sc-remove" onClick={() => onRemove(item.id)} aria-label="Remove">✕</button>
            </div>
          );
        }
        const kindIcon = item.kind === 'transport' ? '🚌' : '📝';
        return (
          <div key={item.id} className="sc-item sc-item--adhoc">
            <span className="sc-item-icon">{kindIcon}</span>
            <span className="sc-item-name">{item.adHoc?.label || '—'}</span>
            <span className="sc-item-controls">
              <button
                className="sc-move-btn"
                onClick={() => onMoveUp(item)}
                disabled={isFirst}
                aria-label="Move up"
              >↑</button>
              <button
                className="sc-move-btn"
                onClick={() => onMoveDown(item)}
                disabled={isLast}
                aria-label="Move down"
              >↓</button>
            </span>
            <button className="sc-remove" onClick={() => onRemove(item.id)} aria-label="Remove">✕</button>
          </div>
        );
      })}

      <button className="sc-add" onClick={onAdd}>+ ADD</button>
      {!flightCards?.length && onSuggestNearby && (
        <button className="sc-suggest-btn" onClick={onSuggestNearby} type="button">
          ◈ NEARBY
        </button>
      )}
    </div>
  );
}
