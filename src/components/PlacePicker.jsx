import { useEffect, useRef, useState } from 'react';
import { addScheduleItem } from '../db/repo.js';
import { PLACE_TYPES, blockMeta } from '../db/constants.js';
import './PlacePicker.css';

export default function PlacePicker({ date, block, trip, places, onConfirm, onClose }) {
  const [mode,       setMode]       = useState('library'); // 'library' | 'adhoc'
  const [search,     setSearch]     = useState('');
  const [filterType, setFilterType] = useState('');
  // Default to showing only trip cities; if the trip has no cities set, show all.
  const [showAll,    setShowAll]    = useState(!trip.cities?.length);
  const [adhocKind,  setAdhocKind]  = useState('note'); // 'note' | 'transport'
  const [adhocLabel, setAdhocLabel] = useState('');
  const [busy,       setBusy]       = useState(false);

  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const placesList = Object.values(places);
  const filtered = placesList.filter((p) => {
    if (!showAll && trip.cities?.length > 0 && !trip.cities.includes(p.city)) return false;
    if (filterType && p.type !== filterType) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.city || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const blockInfo = blockMeta(block);
  const blockLabel = blockInfo
    ? `${blockInfo.emoji} ${blockInfo.label.toUpperCase()}`
    : block.toUpperCase().replace('_', ' ');

  async function handlePickPlace(place) {
    setBusy(true);
    await addScheduleItem({
      tripId:  trip.id,
      date,
      block,
      order:   0,
      kind:    'place',
      placeId: place.id,
      adHoc:   null,
      notes:   '',
    });
    onConfirm();
  }

  async function handleAdHoc(e) {
    e.preventDefault();
    if (!adhocLabel.trim()) return;
    setBusy(true);
    await addScheduleItem({
      tripId:  trip.id,
      date,
      block,
      order:   0,
      kind:    adhocKind,
      placeId: null,
      adHoc:   { label: adhocLabel.trim() },
      notes:   '',
    });
    onConfirm();
  }

  function handleBackdrop(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current) onClose();
  }

  return (
    <div
      className="pp-backdrop"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdrop}
    >
      <div className="pp-panel" role="dialog" aria-modal="true" aria-label="Add to slot">

        <div className="pp-header">
          <span className="pp-title">+ ADD · {blockLabel}</span>
          <button className="pp-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Mode tabs ── */}
        <div className="pp-mode-tabs">
          <button
            className={`pp-tab ${mode === 'library' ? 'pp-tab--active' : ''}`}
            onClick={() => setMode('library')}
          >FROM LIBRARY</button>
          <button
            className={`pp-tab ${mode === 'adhoc' ? 'pp-tab--active' : ''}`}
            onClick={() => setMode('adhoc')}
          >AD-HOC</button>
        </div>

        {/* ── Library mode ── */}
        {mode === 'library' && (
          <div className="pp-library">
            <div className="pp-filters">
              <input
                className="pp-search"
                type="search"
                placeholder="SEARCH PLACES…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
              <select
                className="pp-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                aria-label="Filter by type"
              >
                <option value="">ALL TYPES</option>
                {PLACE_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>{t.emoji} {t.label.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <label className="pp-showall">
              <input
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
              />
              <span>Show all cities</span>
            </label>

            <div className="pp-list" role="listbox">
              {filtered.length === 0 ? (
                <p className="pp-empty">
                  {placesList.length === 0
                    ? 'No places in library yet.'
                    : 'No matches — try a different filter or enable "show all cities".'}
                </p>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    className="pp-place-row"
                    onClick={() => handlePickPlace(p)}
                    disabled={busy}
                    role="option"
                  >
                    <span className="pp-place-icon">
                      {PLACE_TYPES.find((t) => t.key === p.type)?.emoji || '📍'}
                    </span>
                    <span className="pp-place-name">{p.name}</span>
                    {p.city && <span className="pp-place-city">{p.city.toUpperCase()}</span>}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {/* ── Ad-hoc mode ── */}
        {mode === 'adhoc' && (
          <form className="pp-adhoc" onSubmit={handleAdHoc}>
            <div className="pp-adhoc-kinds">
              <label className={`pp-kind ${adhocKind === 'note' ? 'pp-kind--active' : ''}`}>
                <input type="radio" className="sr-only" name="adhocKind" value="note"
                  checked={adhocKind === 'note'}
                  onChange={() => setAdhocKind('note')} />
                📝 NOTE
              </label>
              <label className={`pp-kind ${adhocKind === 'transport' ? 'pp-kind--active' : ''}`}>
                <input type="radio" className="sr-only" name="adhocKind" value="transport"
                  checked={adhocKind === 'transport'}
                  onChange={() => setAdhocKind('transport')} />
                🚌 TRANSPORT
              </label>
            </div>

            <input
              className="pp-adhoc-input"
              type="text"
              placeholder={adhocKind === 'note' ? 'e.g. Lunch at the market' : 'e.g. Bus to old town'}
              value={adhocLabel}
              onChange={(e) => setAdhocLabel(e.target.value)}
              autoFocus
            />

            <button
              type="submit"
              className="pp-adhoc-submit"
              disabled={busy || !adhocLabel.trim()}
            >
              ◈ ADD
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
