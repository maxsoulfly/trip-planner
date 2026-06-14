import { useEffect, useRef, useState } from 'react';
import { addPlace, putPlace } from '../db/repo.js';
import { PLACE_TYPES, STATUSES, WEEKDAYS } from '../db/constants.js';
import { parseMapsUrl } from '../utils/mapsParser.js';
import './PlaceForm.css';

function buildHoursState(openingHours) {
  const src = openingHours || {};
  return Object.fromEntries(
    WEEKDAYS.map((w) => [w.key, src[w.key] !== undefined ? src[w.key] : null])
  );
}

function parseTags(str) {
  return str.split(',').map((t) => t.trim()).filter(Boolean);
}

export default function PlaceForm({ initialData, onSave, onClose }) {
  const isEdit = Boolean(initialData);

  const [name,         setName]         = useState(initialData?.name         || '');
  const [type,         setType]         = useState(initialData?.type         || 'other');
  const [status,       setStatus]       = useState(initialData?.status       || 'wishlist');
  const [city,         setCity]         = useState(initialData?.city         || '');
  const [country,      setCountry]      = useState(initialData?.country      || '');
  const [address,      setAddress]      = useState(initialData?.address      || '');
  const [lat,          setLat]          = useState(initialData?.lat          ?? '');
  const [lng,          setLng]          = useState(initialData?.lng          ?? '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(initialData?.googleMapsUrl || '');
  const [untappdUrl,   setUntappdUrl]   = useState(initialData?.untappdUrl   || '');
  const [rating,       setRating]       = useState(initialData?.rating       ?? '');
  const [tags,         setTags]         = useState((initialData?.tags || []).join(', '));
  const [notes,        setNotes]        = useState(initialData?.notes        || '');
  const [hours,        setHours]        = useState(() => buildHoursState(initialData?.openingHours));
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState('');
  const [prefillUrl,   setPrefillUrl]   = useState('');
  const [prefillMsg,   setPrefillMsg]   = useState(null); // { ok, text } | null

  const firstRef = useRef(null);

  // Focus first field on open; ESC to close.
  useEffect(() => {
    firstRef.current?.focus();
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handlePrefill(url) {
    const parsed = parseMapsUrl(url);

    if (parsed.short) {
      setPrefillMsg({ ok: false, text: 'Short link detected. Open it in your browser, then copy the URL from the address bar.' });
      return;
    }

    const filled = [];
    if (parsed.name)                           { setName(parsed.name);         filled.push('name'); }
    if (parsed.lat != null && parsed.lng != null) {
      setLat(String(parsed.lat));
      setLng(String(parsed.lng));
      filled.push('coordinates');
    }
    setGoogleMapsUrl(url);

    setPrefillMsg(
      filled.length > 0
        ? { ok: true,  text: `Prefilled: ${filled.join(' · ')} · maps URL` }
        : { ok: false, text: 'URL stored — name and coordinates not found in this link.' }
    );
  }

  function handlePrefillPaste(e) {
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    e.preventDefault();
    setPrefillUrl(text);
    handlePrefill(text);
  }

  function setDayOpen(key, open) {
    setHours((h) => ({
      ...h,
      [key]: open ? { open: '10:00', close: '22:00' } : null,
    }));
  }

  function setDayTime(key, field, value) {
    setHours((h) => ({
      ...h,
      [key]: { ...(h[key] || { open: '', close: '' }), [field]: value },
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setBusy(true);
    setError('');

    const data = {
      name:          name.trim(),
      type,
      status,
      city:          city.trim(),
      country:       country.trim(),
      address:       address.trim(),
      lat:           lat !== '' ? parseFloat(lat) : null,
      lng:           lng !== '' ? parseFloat(lng) : null,
      googleMapsUrl: googleMapsUrl.trim(),
      untappdUrl:    untappdUrl.trim(),
      rating:        rating !== '' ? parseFloat(rating) : null,
      tags:          parseTags(tags),
      notes:         notes.trim(),
      openingHours:  hours,
    };

    try {
      if (isEdit) {
        await putPlace({ ...initialData, ...data });
      } else {
        await addPlace(data);
      }
      onSave();
    } catch (err) {
      setError('Save failed — check the console.');
      console.error(err);
      setBusy(false);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit place' : 'Add place'}
      >
        <div className="modal-header">
          <span className="modal-title">{isEdit ? '◈ EDIT CACHE' : '◈ NEW CACHE'}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close form">✕</button>
        </div>

        <form className="place-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error" role="alert">{error}</div>}

          {/* ---- Prefill strip (add mode only) ---- */}
          {!isEdit && (
            <div className="prefill-strip">
              <span className="prefill-label">PREFILL FROM MAPS LINK</span>
              <div className="prefill-row">
                <input
                  className="prefill-input"
                  type="url"
                  value={prefillUrl}
                  onChange={(e) => setPrefillUrl(e.target.value)}
                  onPaste={handlePrefillPaste}
                  placeholder="Paste a Google Maps URL…"
                  aria-label="Google Maps URL for prefill"
                />
                <button
                  type="button"
                  className="prefill-btn"
                  onClick={() => handlePrefill(prefillUrl)}
                >
                  PARSE
                </button>
              </div>
              {prefillMsg && (
                <span className={`prefill-msg ${prefillMsg.ok ? 'prefill-msg--ok' : 'prefill-msg--warn'}`}>
                  {prefillMsg.ok ? '✓' : '⚠'} {prefillMsg.text}
                </span>
              )}
            </div>
          )}

          {/* ---- Identity ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">IDENTITY</legend>

            <label className="form-row">
              <span className="form-label">NAME *</span>
              <input
                ref={firstRef}
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Świat Piwa"
                required
              />
            </label>

            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">TYPE</span>
                <select className="form-select" value={type} onChange={(e) => setType(e.target.value)}>
                  {PLACE_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-row">
                <span className="form-label">STATUS</span>
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-row">
                <span className="form-label">RATING (0–5)</span>
                <input
                  className="form-input"
                  type="number"
                  min="0" max="5" step="0.5"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  placeholder="—"
                />
              </label>
            </div>
          </fieldset>

          {/* ---- Location ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">LOCATION</legend>

            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">CITY</span>
                <input className="form-input" type="text"
                  value={city} onChange={(e) => setCity(e.target.value)}
                  placeholder="Kraków" />
              </label>
              <label className="form-row">
                <span className="form-label">COUNTRY</span>
                <input className="form-input" type="text"
                  value={country} onChange={(e) => setCountry(e.target.value)}
                  placeholder="PL" />
              </label>
            </div>

            <label className="form-row">
              <span className="form-label">ADDRESS</span>
              <input className="form-input" type="text"
                value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address" />
            </label>

            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">LAT</span>
                <input className="form-input" type="number" step="any"
                  value={lat} onChange={(e) => setLat(e.target.value)}
                  placeholder="50.057" />
              </label>
              <label className="form-row">
                <span className="form-label">LNG</span>
                <input className="form-input" type="number" step="any"
                  value={lng} onChange={(e) => setLng(e.target.value)}
                  placeholder="19.939" />
              </label>
            </div>

            <label className="form-row">
              <span className="form-label">GOOGLE MAPS URL</span>
              <input className="form-input" type="url"
                value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)}
                placeholder="https://maps.google.com/…" />
            </label>
          </fieldset>

          {/* ---- Links ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">LINKS</legend>
            <label className="form-row">
              <span className="form-label">UNTAPPD URL</span>
              <input className="form-input" type="url"
                value={untappdUrl} onChange={(e) => setUntappdUrl(e.target.value)}
                placeholder="https://untappd.com/v/…" />
            </label>
          </fieldset>

          {/* ---- Notes & Tags ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">NOTES & TAGS</legend>
            <label className="form-row">
              <span className="form-label">TAGS (comma-separated)</span>
              <input className="form-input" type="text"
                value={tags} onChange={(e) => setTags(e.target.value)}
                placeholder="craft, must-visit, outdoor" />
            </label>
            <label className="form-row">
              <span className="form-label">NOTES</span>
              <textarea className="form-input form-textarea"
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth knowing…"
                rows={3} />
            </label>
          </fieldset>

          {/* ---- Opening Hours ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">OPENING HOURS</legend>
            <div className="hours-editor">
              {WEEKDAYS.map((w) => {
                const h      = hours[w.key];
                const isOpen = h !== null && h !== undefined;
                return (
                  <div key={w.key} className="hours-row">
                    <span className="hours-day-lbl">{w.label.toUpperCase()}</span>

                    <label className="hours-toggle" title={isOpen ? 'Click to mark closed' : 'Click to mark open'}>
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={(e) => setDayOpen(w.key, e.target.checked)}
                        className="sr-only"
                      />
                      <span className={`hours-badge ${isOpen ? 'hours-badge--open' : 'hours-badge--closed'}`}>
                        {isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </label>

                    {isOpen && (
                      <div className="hours-times">
                        <input
                          className="form-input form-input--time"
                          type="time"
                          value={h?.open || ''}
                          onChange={(e) => setDayTime(w.key, 'open', e.target.value)}
                          aria-label={`${w.label} opening time`}
                        />
                        <span className="hours-dash">–</span>
                        <input
                          className="form-input form-input--time"
                          type="time"
                          value={h?.close || ''}
                          onChange={(e) => setDayTime(w.key, 'close', e.target.value)}
                          aria-label={`${w.label} closing time`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </fieldset>

          {/* ---- Actions ---- */}
          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={busy}>
              {busy ? 'SAVING…' : isEdit ? '◈ SAVE CHANGES' : '◈ ADD TO LIBRARY'}
            </button>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
