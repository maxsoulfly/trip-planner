import { WEEKDAYS, typeMeta } from '../db/constants.js';
import { hoursForDay } from '../utils/hours.js';
import './PlaceCard.css';

const JS_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_ABBR    = { mon:'M', tue:'T', wed:'W', thu:'T', fri:'F', sat:'S', sun:'S' };

const STAMP = {
  wishlist: { label: '☆ FLAGGED', cls: 'stamp--flagged' },
  planned:  { label: '◐ MARKED',  cls: 'stamp--marked'  },
  visited:  { label: '✓ SECURED', cls: 'stamp--secured' },
};

function todayWeekdayKey() {
  return JS_DAY_KEYS[new Date().getDay()];
}

export default function PlaceCard({ place, onEdit, onDelete }) {
  const type   = typeMeta(place.type);
  const stamp  = STAMP[place.status] || STAMP.wishlist;
  const today  = todayWeekdayKey();

  const todayHours = hoursForDay(place.openingHours, today);
  const isOpen     = todayHours !== 'Closed' && todayHours !== '—';
  const isClosed   = todayHours === 'Closed';

  const coordParts = [
    place.city,
    place.country,
    place.lat != null && place.lng != null ? `${place.lat}, ${place.lng}` : null,
  ].filter(Boolean);

  return (
    <article className="card">
      <span className="card-corner" aria-hidden="true" />
      <span className={`stamp ${stamp.cls}`}>{stamp.label}</span>

      <div className="card-eyebrow">
        <span className="card-glyph">{type.emoji}</span>
        {' '}{type.label.toUpperCase()}
      </div>

      <h2 className="card-title">{place.name}</h2>

      {coordParts.length > 0 && (
        <div className="card-coords">{coordParts.join(' · ')}</div>
      )}

      <div className="hours-box">
        <div className="hours-today">
          <span className="hours-day-label">{today.toUpperCase()}</span>
          <span className={
            `hours-readout${isClosed ? ' hours-readout--closed' : isOpen ? ' hours-readout--open' : ''}`
          }>
            {isClosed ? 'CLOSED' : isOpen ? `OPEN · ${todayHours}` : '—'}
          </span>
        </div>
        <div className="hours-week">
          {WEEKDAYS.map((w) => {
            const h    = place.openingHours?.[w.key];
            const open = h && h.open && h.close;
            const shut = h === null;
            return (
              <span
                key={w.key}
                className={[
                  'hours-pip',
                  open ? 'pip--open' : shut ? 'pip--closed' : 'pip--unknown',
                  w.key === today ? 'pip--today' : '',
                ].join(' ')}
                title={`${w.label}: ${hoursForDay(place.openingHours, w.key)}`}
              >
                {DAY_ABBR[w.key]}
              </span>
            );
          })}
        </div>
      </div>

      <div className="card-foot">
        {place.googleMapsUrl
          ? (
            <a className="maps-link" href={place.googleMapsUrl} target="_blank" rel="noreferrer">
              ▸ OPEN IN GOOGLE MAPS
            </a>
          ) : (
            <span className="maps-link maps-link--none">▸ NO MAP LINK</span>
          )
        }
        <div className="card-tags">
          {(place.tags || []).slice(0, 3).map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
          {place.rating != null && <span className="tag">★ {place.rating}</span>}
        </div>
      </div>

      <div className="card-actions">
        <button className="card-btn" onClick={onEdit} aria-label={`Edit ${place.name}`}>
          EDIT
        </button>
        <button className="card-btn card-btn--danger" onClick={onDelete} aria-label={`Delete ${place.name}`}>
          DEL
        </button>
      </div>
    </article>
  );
}
