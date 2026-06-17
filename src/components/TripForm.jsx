import { useEffect, useRef, useState } from 'react';
import { addTrip, putTrip, getAllPlaces } from '../db/repo.js';
import './TripForm.css';

const EMPTY_FLIGHT = { airline: '', number: '', from: '', to: '', depTime: '', arrTime: '' };

// Old seed data stored full ISO datetime strings ('2025-11-16T11:00') in depTime/arrTime.
// time inputs need 'HH:MM'. Strip the date prefix if present.
function normalizeTime(val) {
  if (!val) return '';
  const t = val.includes('T') ? val.split('T')[1] : val;
  return t.slice(0, 5);
}

function normalizeFlight(f) {
  if (!f) return { ...EMPTY_FLIGHT };
  return { ...f, depTime: normalizeTime(f.depTime), arrTime: normalizeTime(f.arrTime) };
}

// Inline sub-component for the six flight fields — only rendered when the
// corresponding "has flight" toggle is checked.
function FlightFields({ value, onChange }) {
  function set(field, val) { onChange({ ...value, [field]: val }); }
  return (
    <div className="flight-fields">
      <div className="flight-row">
        <label className="form-row">
          <span className="form-label">FROM</span>
          <input className="form-input tf-iata" type="text" maxLength={4}
            value={value.from} onChange={(e) => set('from', e.target.value.toUpperCase())}
            placeholder="TLV" />
        </label>
        <label className="form-row">
          <span className="form-label">DEP</span>
          <input className="form-input form-input--time" type="time"
            value={value.depTime} onChange={(e) => set('depTime', e.target.value)} />
        </label>
        <span className="flight-arrow">→</span>
        <label className="form-row">
          <span className="form-label">TO</span>
          <input className="form-input tf-iata" type="text" maxLength={4}
            value={value.to} onChange={(e) => set('to', e.target.value.toUpperCase())}
            placeholder="SOF" />
        </label>
        <label className="form-row">
          <span className="form-label">ARR</span>
          <input className="form-input form-input--time" type="time"
            value={value.arrTime} onChange={(e) => set('arrTime', e.target.value)} />
        </label>
      </div>
      <div className="flight-row">
        <label className="form-row tf-grow">
          <span className="form-label">AIRLINE</span>
          <input className="form-input" type="text"
            value={value.airline} onChange={(e) => set('airline', e.target.value)}
            placeholder="Wizz Air" />
        </label>
        <label className="form-row">
          <span className="form-label">NUMBER</span>
          <input className="form-input tf-flight-num" type="text"
            value={value.number} onChange={(e) => set('number', e.target.value)}
            placeholder="W6 4428" />
        </label>
      </div>
    </div>
  );
}

export default function TripForm({ initialData, onSave, onClose }) {
  const isEdit = Boolean(initialData);

  const [title,        setTitle]        = useState(initialData?.title        || '');
  const [citiesStr,    setCitiesStr]    = useState((initialData?.cities || []).join(', '));
  const [startDate,    setStartDate]    = useState(initialData?.startDate    || '');
  const [endDate,      setEndDate]      = useState(initialData?.endDate      || '');
  const [notes,        setNotes]        = useState(initialData?.notes        || '');
  const [hasOutbound,  setHasOutbound]  = useState(Boolean(initialData?.outboundFlight));
  const [outbound,     setOutbound]     = useState(normalizeFlight(initialData?.outboundFlight));
  const [hasInbound,   setHasInbound]   = useState(Boolean(initialData?.inboundFlight));
  const [inbound,      setInbound]      = useState(normalizeFlight(initialData?.inboundFlight));
  const [accomIds,     setAccomIds]     = useState(initialData?.accommodationPlaceIds || []);
  const [accomPlaces,  setAccomPlaces]  = useState([]);
  const [accomSearch,  setAccomSearch]  = useState('');
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState('');

  const firstRef        = useRef(null);
  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);
  const endDateRef      = useRef(null);
  const handleSubmitRef = useRef(null);

  // Keep ref current so the keydown handler always calls the latest handleSubmit.
  handleSubmitRef.current = handleSubmit;

  // Focus first field on open; ESC to close; Enter to save (not in textareas).
  useEffect(() => {
    firstRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleSubmitRef.current(e);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Load accommodation places from the library for the checklist.
  useEffect(() => {
    getAllPlaces().then((ps) =>
      setAccomPlaces(ps.filter((p) => p.type === 'accommodation'))
    );
  }, []);

  const filteredAccom = accomSearch.trim()
    ? accomPlaces.filter((p) => {
        const q = accomSearch.trim().toLowerCase();
        return p.name.toLowerCase().includes(q) || (p.city || '').toLowerCase().includes(q);
      })
    : accomPlaces;

  function toggleAccomId(id, checked) {
    setAccomIds((ids) =>
      checked ? [...ids, id] : ids.filter((x) => x !== id)
    );
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!title.trim())  { setError('Title is required.'); return; }
    if (!startDate)     { setError('Start date is required.'); return; }
    if (!endDate)       { setError('End date is required.'); return; }
    if (startDate > endDate) { setError('Start date must be on or before end date.'); return; }

    setBusy(true);
    setError('');

    const data = {
      title:                 title.trim(),
      cities:                citiesStr.split(',').map((s) => s.trim()).filter(Boolean),
      startDate,
      endDate,
      outboundFlight:        hasOutbound ? { ...outbound } : null,
      inboundFlight:         hasInbound  ? { ...inbound  } : null,
      accommodationPlaceIds: accomIds,
      notes:                 notes.trim(),
    };

    try {
      if (isEdit) {
        await putTrip({ ...initialData, ...data });
      } else {
        await addTrip(data);
      }
      onSave();
    } catch (err) {
      setError('Save failed — check the console.');
      console.error(err);
      setBusy(false);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current) onClose();
  }

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdropClick}
    >
      <div className="modal-panel" role="dialog" aria-modal="true"
           aria-label={isEdit ? 'Edit trip' : 'New trip'}>

        <div className="modal-header">
          <span className="modal-title">{isEdit ? '◈ EDIT TRIP' : '◈ NEW TRIP'}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <form className="trip-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error" role="alert">{error}</div>}

          {/* ---- Trip details ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">DETAILS</legend>

            <label className="form-row">
              <span className="form-label">TITLE *</span>
              <input ref={firstRef} className="form-input" type="text"
                value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Kraków + Warsaw 2026" required />
            </label>

            <label className="form-row">
              <span className="form-label">CITIES (comma-separated)</span>
              <input className="form-input" type="text"
                value={citiesStr} onChange={(e) => setCitiesStr(e.target.value)}
                placeholder="Kraków, Warsaw" />
            </label>

            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">START DATE *</span>
                <input className="form-input" type="date"
                  value={startDate}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    if (endDate && val && endDate < val) setEndDate('');
                    setTimeout(() => endDateRef.current?.focus(), 0);
                  }} />
              </label>
              <label className="form-row">
                <span className="form-label">END DATE *</span>
                <input className="form-input" type="date"
                  ref={endDateRef}
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => setEndDate(e.target.value)} />
              </label>
            </div>

            <label className="form-row">
              <span className="form-label">NOTES</span>
              <textarea className="form-input form-textarea"
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth knowing…" rows={2} />
            </label>
          </fieldset>

          {/* ---- Outbound flight ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">OUTBOUND FLIGHT</legend>
            <label className="flight-toggle">
              <input type="checkbox" className="sr-only"
                checked={hasOutbound}
                onChange={(e) => setHasOutbound(e.target.checked)} />
              <span className={`hours-badge ${hasOutbound ? 'hours-badge--open' : 'hours-badge--closed'}`}>
                {hasOutbound ? 'SET' : 'NOT SET'}
              </span>
            </label>
            {hasOutbound && (
              <FlightFields value={outbound} onChange={setOutbound} />
            )}
          </fieldset>

          {/* ---- Inbound flight ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">INBOUND FLIGHT</legend>
            <label className="flight-toggle">
              <input type="checkbox" className="sr-only"
                checked={hasInbound}
                onChange={(e) => setHasInbound(e.target.checked)} />
              <span className={`hours-badge ${hasInbound ? 'hours-badge--open' : 'hours-badge--closed'}`}>
                {hasInbound ? 'SET' : 'NOT SET'}
              </span>
            </label>
            {hasInbound && (
              <FlightFields value={inbound} onChange={setInbound} />
            )}
          </fieldset>

          {/* ---- Accommodation ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">ACCOMMODATION</legend>
            {accomPlaces.length === 0 ? (
              <p className="tf-hint">
                No accommodation in your library yet.
                Add places of type "Accommodation" to the place library first.
              </p>
            ) : (
              <>
                <input
                  className="form-input"
                  type="search"
                  placeholder="FILTER BY NAME OR CITY…"
                  value={accomSearch}
                  onChange={(e) => setAccomSearch(e.target.value)}
                  aria-label="Filter accommodation"
                />
                {filteredAccom.length === 0 ? (
                  <p className="tf-hint">No matches.</p>
                ) : (
                  <div className="accom-list">
                    {filteredAccom.map((p) => (
                      <label key={p.id} className="accom-row">
                        <input
                          type="checkbox"
                          checked={accomIds.includes(p.id)}
                          onChange={(e) => toggleAccomId(p.id, e.target.checked)}
                        />
                        <span className="accom-name">{p.name}</span>
                        {p.city && <span className="accom-city">{p.city.toUpperCase()}</span>}
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}
          </fieldset>

          {/* ---- Actions ---- */}
          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={busy}>
              {busy ? 'SAVING…' : isEdit ? '◈ SAVE CHANGES' : '◈ CREATE TRIP'}
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
