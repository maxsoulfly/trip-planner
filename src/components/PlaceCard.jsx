import { useState } from 'react';
import { WEEKDAYS } from '../db/constants.js';
import { useSettings, typeMetaFrom } from '../context/SettingsContext.jsx';
import { hoursForDay } from '../utils/hours.js';
import './PlaceCard.css';

const JS_DAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const DAY_ABBR    = { mon:'M', tue:'T', wed:'W', thu:'T', fri:'F', sat:'S', sun:'S' };

const STAMP = {
  wishlist:           { label: '☆ FLAGGED', cls: 'stamp--flagged' },
  planned:            { label: '◐ MARKED',  cls: 'stamp--marked'  },
  visited:            { label: '✓ SECURED', cls: 'stamp--secured' },
  permanently_closed: { label: '✕ PERM. CLOSED', cls: 'stamp--dead' },
};

function todayWeekdayKey() {
  return JS_DAY_KEYS[new Date().getDay()];
}

// Returns { label, cls } for the real-time status badge, or null if hours are unknown.
function getStatusBadge(openingHours, todayKey) {
  const entry = openingHours?.[todayKey];
  if (entry === undefined) return null;                                    // unknown
  if (entry === null)      return { label: 'CLOSED', cls: 'hours-readout--closed' };
  if (!entry.open || !entry.close) return null;

  const now     = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  const [openH,  openM]  = entry.open.split(':').map(Number);
  const [closeH, closeM] = entry.close.split(':').map(Number);
  const openMins  = openH * 60 + openM;
  const closeMins = (closeH === 0 && closeM === 0) ? 24 * 60 : closeH * 60 + closeM;
  const overnight = closeMins < openMins; // e.g. 16:00–01:00; equal times fall through to AND branch (closed)

  const isOpen = overnight
    ? (nowMins >= openMins || nowMins < closeMins)
    : (nowMins >= openMins && nowMins < closeMins);

  if (isOpen) {
    return { label: 'OPEN', cls: 'hours-readout--open' };
  }
  if (nowMins < openMins) {
    const diff = openMins - nowMins;
    return diff <= 15
      ? { label: `OPENS SOON · ${entry.open}`, cls: 'hours-readout--open'  }
      : { label: `OPENS ${entry.open}`,         cls: 'hours-readout--steel' };
  }
  return { label: 'CLOSED TODAY', cls: 'hours-readout--closed' };
}

export default function PlaceCard({ place, onEdit, onDelete, incomplete }) {
  const { placeTypes } = useSettings();
  const [confirming, setConfirming] = useState(false);

  const type   = typeMetaFrom(placeTypes, place.type);
  const stamp  = STAMP[place.status] || STAMP.wishlist;
  const today  = todayWeekdayKey();
  const badge  = getStatusBadge(place.openingHours, today);

  const cityLabel = place.city
    ? place.city + (place.state ? `, ${place.state}` : '')
    : null;

  const coordParts = [
    cityLabel,
    place.country,
    place.lat != null && place.lng != null ? `${place.lat}, ${place.lng}` : null,
  ].filter(Boolean);

  const mapsHref = place.googleMapsUrl
    || (place.lat && place.lng
        ? `https://www.google.com/maps?q=${place.lat},${place.lng}`
        : `https://www.google.com/maps/search/${encodeURIComponent((place.name + ' ' + (place.city || '')).trim())}`);

  return (
    <article className="card">
      <span className="card-corner" aria-hidden="true" />
      <span className={`stamp ${stamp.cls}`}>{stamp.label}</span>

      <div className="card-eyebrow">
        <span><span className="card-glyph">{type.emoji}</span>{' '}{type.label.toUpperCase()}</span>
        {incomplete && <span className="card-stub" aria-label="Incomplete record">⚠</span>}
      </div>

      <h2 className="card-title">
        <a className="card-name-link" href={mapsHref} target="_blank" rel="noopener noreferrer">
          {place.name}
        </a>
      </h2>

      {coordParts.length > 0 && (
        <div className="card-coords">{coordParts.join(' · ')}</div>
      )}

      {place.type === 'accommodation' && (place.checkIn || place.checkOut) && (
        <div className="card-accom-times">
          {place.checkIn  && <span>▸ CHECK-IN  {place.checkIn}</span>}
          {place.checkOut && <span>▸ CHECK-OUT {place.checkOut}</span>}
        </div>
      )}

      <div className="hours-box">
        <div className="hours-today">
          <span className="hours-day-label">{today.toUpperCase()}</span>
          <span className={`hours-readout${badge ? ` ${badge.cls}` : ''}`}>
            {badge ? badge.label : '—'}
          </span>
        </div>
        <div className="hours-week">
          {WEEKDAYS.map((w) => {
            const h       = place.openingHours?.[w.key];
            const open    = h && h.open && h.close;
            const isToday = w.key === today;
            return (
              <div
                key={w.key}
                className={`pip-wrapper${isToday ? ` pip-wrapper--today${open ? ' pip-wrapper--open' : ' pip-wrapper--closed'}` : ''}`}
              >
                <span
                  className={`hours-pip${open ? ' pip--open' : ' pip--closed'}`}
                  title={`${w.label}: ${hoursForDay(place.openingHours, w.key)}`}
                >
                  {DAY_ABBR[w.key]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card-foot">
        <div className="card-links">
          {place.googleMapsUrl
            ? (
              <a className="maps-link" href={place.googleMapsUrl} target="_blank" rel="noreferrer">
                ▸ GOOGLE MAPS
              </a>
            ) : (
              <span className="maps-link maps-link--none">▸ NO MAP LINK</span>
            )
          }
          {place.untappdUrl && (
            <a className="maps-link" href={place.untappdUrl} target="_blank" rel="noreferrer">
              ▸ UNTAPPD
            </a>
          )}
          {place.websiteUrl && (
            <a className="website-link" href={place.websiteUrl} target="_blank" rel="noreferrer">
              ▸ WEBSITE
            </a>
          )}
        </div>
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
        {confirming ? (
          <span className="card-confirm-row">
            <span className="card-confirm-label">REALLY?</span>
            <button className="card-btn card-btn--confirm" onClick={onDelete}>CONFIRM</button>
            <button className="card-btn" onClick={() => setConfirming(false)}>CANCEL</button>
          </span>
        ) : (
          <button
            className="card-btn card-btn--danger"
            onClick={() => setConfirming(true)}
            aria-label={`Delete ${place.name}`}
          >
            DEL
          </button>
        )}
      </div>
    </article>
  );
}
