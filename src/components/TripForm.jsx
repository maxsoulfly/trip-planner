import { useEffect, useRef, useState } from 'react';
import { addTrip, putTrip } from '../db/repo.js';
import { parseFlightEmail } from '../utils/flightParser.js';
import './TripForm.css';

const EMPTY_FLIGHT = {
  airline: '', number: '', from: '', to: '',
  depTime: '', arrTime: '', depDate: '', arrDate: '',
};

// Old seed data stored full ISO datetime strings ('2025-11-16T11:00') in depTime/arrTime.
// time inputs need 'HH:MM'. Strip the date prefix if present.
function normalizeTime(val) {
  if (!val) return '';
  const t = val.includes('T') ? val.split('T')[1] : val;
  return t.slice(0, 5);
}

function normalizeFlight(f) {
  if (!f) return { ...EMPTY_FLIGHT };
  return {
    ...EMPTY_FLIGHT,
    ...f,
    depTime: normalizeTime(f.depTime),
    arrTime: normalizeTime(f.arrTime),
  };
}

// Inline sub-component for flight fields — only rendered when toggle is checked.
function FlightFields({ value, onChange }) {
  function set(field, val) { onChange({ ...value, [field]: val }); }
  const overnightWarn = value.depTime && value.arrTime &&
    value.arrDate === value.depDate && value.arrTime < value.depTime;
  return (
    <div className="flight-fields">
      {/* Date + time row */}
      <div className="flight-date-row">
        <div className="flight-date-group">
          <span className="flight-label">DEP DATE</span>
          <input type="date" className="flight-date-input"
            value={value.depDate || ''}
            onChange={e => set('depDate', e.target.value)} />
        </div>
        <div className="flight-date-group">
          <span className="flight-label">DEP TIME</span>
          <input type="time" className="form-input form-input--time"
            value={value.depTime || ''}
            onChange={e => set('depTime', e.target.value)} />
        </div>
        <span className="flight-arrow">→</span>
        <div className="flight-date-group">
          <span className="flight-label">ARR DATE</span>
          <input type="date" className="flight-date-input"
            value={value.arrDate || ''}
            onChange={e => set('arrDate', e.target.value)} />
        </div>
        <div className="flight-date-group">
          <span className="flight-label">ARR TIME</span>
          <input type="time" className="form-input form-input--time"
            value={value.arrTime || ''}
            onChange={e => set('arrTime', e.target.value)} />
        </div>
      </div>
      {overnightWarn && (
        <span className="flight-warn">⚠ arrival before departure — next day?</span>
      )}
      {/* Route row */}
      <div className="flight-row">
        <label className="form-row">
          <span className="form-label">FROM</span>
          <input className="form-input tf-iata" type="text" maxLength={4}
            value={value.from} onChange={(e) => set('from', e.target.value.toUpperCase())}
            placeholder="TLV" />
        </label>
        <label className="form-row">
          <span className="form-label">TO</span>
          <input className="form-input tf-iata" type="text" maxLength={4}
            value={value.to} onChange={(e) => set('to', e.target.value.toUpperCase())}
            placeholder="SOF" />
        </label>
      </div>
      {/* Airline row */}
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
  const [busy,            setBusy]            = useState(false);
  const [error,           setError]           = useState('');
  const [showFlightPaste, setShowFlightPaste] = useState(false);
  const [flightPaste,     setFlightPaste]     = useState('');
  const [flightParsed,    setFlightParsed]    = useState(null);
  const [flightMsg,       setFlightMsg]       = useState('');

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

  function handleFlightParse(text) {
    const src = text ?? flightPaste;
    if (!src.trim()) return;
    const result = parseFlightEmail(src);
    setFlightParsed(result);
    const found = [result.outbound && 'outbound', result.inbound && 'inbound'].filter(Boolean);
    setFlightMsg(found.length
      ? `✓ found: ${found.join(' + ')} — review and apply`
      : '⚠ no flight data found');
  }

  function applyFlightParse() {
    if (!flightParsed) return;
    if (flightParsed.outbound) {
      setOutbound({
        ...flightParsed.outbound,
        depDate: flightParsed.outbound.depDate || flightParsed.startDate || '',
        arrDate: flightParsed.outbound.arrDate || flightParsed.startDate || '',
      });
      setHasOutbound(true);
    }
    if (flightParsed.inbound) {
      setInbound({
        ...flightParsed.inbound,
        depDate: flightParsed.inbound.depDate || flightParsed.endDate || '',
        arrDate: flightParsed.inbound.arrDate || flightParsed.endDate || '',
      });
      setHasInbound(true);
    }
    // Only prefill trip dates when form dates are currently empty.
    if (flightParsed.startDate && !startDate) setStartDate(flightParsed.startDate);
    if (flightParsed.endDate   && !endDate)   setEndDate(flightParsed.endDate);
    setFlightParsed(null);
    setFlightPaste('');
    setFlightMsg('✓ applied — review flight fields below');
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
                    if (val) setOutbound(prev => ({ ...prev, depDate: prev.depDate || val }));
                    setTimeout(() => endDateRef.current?.focus(), 0);
                  }} />
              </label>
              <label className="form-row">
                <span className="form-label">END DATE *</span>
                <input className="form-input" type="date"
                  ref={endDateRef}
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndDate(val);
                    if (val) setInbound(prev => ({ ...prev, depDate: prev.depDate || val }));
                  }} />
              </label>
            </div>

            <label className="form-row">
              <span className="form-label">NOTES</span>
              <textarea className="form-input form-textarea"
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth knowing…" rows={2} />
            </label>

            {/* Flight email paste — collapsible, most edits won't need it */}
            <div className="flight-paste-section">
              <button
                type="button"
                className="flight-paste-toggle"
                onClick={() => setShowFlightPaste(s => !s)}
              >
                {showFlightPaste ? '▾' : '▸'} PASTE FLIGHT EMAIL
              </button>
              {showFlightPaste && (
                <div className="flight-paste-body">
                  <textarea
                    className="flight-paste-textarea"
                    rows={6}
                    value={flightPaste}
                    onChange={e => setFlightPaste(e.target.value)}
                    onPaste={e => {
                      const text = e.clipboardData?.getData('text/plain') || '';
                      if (text) { e.preventDefault(); setFlightPaste(text); handleFlightParse(text); }
                    }}
                    placeholder="Paste Wizzair / Ryanair booking email text here"
                  />
                  <div className="flight-paste-actions">
                    <button type="button" className="prefill-btn"
                      onClick={() => handleFlightParse()}>PARSE</button>
                    {flightMsg && (
                      <span className={`flight-paste-msg${!flightParsed && flightMsg.startsWith('⚠') ? ' flight-paste-msg--warn' : ''}`}>
                        {flightMsg}
                      </span>
                    )}
                  </div>
                  {flightParsed && (flightParsed.outbound || flightParsed.inbound) && (
                    <div className="flight-paste-preview">
                      {flightParsed.outbound && (
                        <div className="fpp-leg">
                          <span className="fpp-label">OUT</span>
                          <span className="fpp-value">
                            {flightParsed.outbound.number} · {flightParsed.outbound.from}→{flightParsed.outbound.to} · {flightParsed.outbound.depTime}
                          </span>
                        </div>
                      )}
                      {flightParsed.inbound && (
                        <div className="fpp-leg">
                          <span className="fpp-label">IN</span>
                          <span className="fpp-value">
                            {flightParsed.inbound.number} · {flightParsed.inbound.from}→{flightParsed.inbound.to} · {flightParsed.inbound.depTime}
                          </span>
                        </div>
                      )}
                      {(flightParsed.startDate || flightParsed.endDate) && (
                        <div className="fpp-dates">
                          {flightParsed.startDate && !startDate && `will set start: ${flightParsed.startDate}`}
                          {flightParsed.endDate && !endDate && ` · will set end: ${flightParsed.endDate}`}
                        </div>
                      )}
                      <button type="button" className="flight-paste-apply"
                        onClick={applyFlightParse}>
                        ◈ APPLY TO FLIGHT FIELDS
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
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
