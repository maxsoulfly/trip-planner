import { useRef, useState, useMemo } from 'react';
import { getAllPlaces, mergeCities, setCountryForCity } from '../db/repo.js';
import './CitiesModal.css';

function buildCityList(places) {
  const byCity = new Map();
  places.forEach(p => {
    const key = (p.city || '').toLowerCase().trim();
    const display = p.city || '';
    if (!byCity.has(key)) byCity.set(key, { display, count: 0, countries: new Set() });
    const entry = byCity.get(key);
    entry.count++;
    if (p.country) entry.countries.add(p.country);
  });
  return [...byCity.values()].sort((a, b) => {
    if (!a.display && b.display)  return -1;
    if (a.display  && !b.display) return 1;
    return a.display.localeCompare(b.display);
  });
}

export default function CitiesModal({ places: initialPlaces, onClose, onRefresh }) {
  const [places,       setPlaces]       = useState(initialPlaces);
  const [search,       setSearch]       = useState('');
  const [selectedCity, setSelectedCity] = useState(null);
  const [renameVal,    setRenameVal]    = useState('');
  const [mergeSearch,  setMergeSearch]  = useState('');
  const [fixCountry,   setFixCountry]   = useState('');
  const [busy,         setBusy]         = useState(false);

  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);

  const cityList = useMemo(() => buildCityList(places), [places]);

  const filteredList = useMemo(() => {
    if (!search.trim()) return cityList;
    const q = search.toLowerCase();
    return cityList.filter(c => (c.display || '(no city)').toLowerCase().includes(q));
  }, [cityList, search]);

  async function refresh() {
    const fresh = await getAllPlaces();
    setPlaces(fresh);
    setSelectedCity(null);
    setRenameVal('');
    setMergeSearch('');
    setFixCountry('');
    onRefresh();
  }

  async function handleRename() {
    if (busy) return;
    setBusy(true);
    try {
      await mergeCities(selectedCity.display, renameVal.trim());
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleMerge(targetCity) {
    if (busy) return;
    setBusy(true);
    try {
      await mergeCities(selectedCity.display, targetCity);
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function handleFixCountry() {
    if (busy || !fixCountry.trim()) return;
    setBusy(true);
    try {
      await setCountryForCity(selectedCity.display, fixCountry.trim());
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  function selectCity(city) {
    if (selectedCity?.display === city.display) {
      setSelectedCity(null);
    } else {
      setSelectedCity(city);
      setRenameVal('');
      setMergeSearch('');
      setFixCountry('');
    }
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current && !busy) onClose();
  }

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdropClick}
    >
      <div className="modal-panel cm-panel" role="dialog" aria-modal="true" aria-label="City management">
        <div className="modal-header">
          <span className="modal-title">◈ CITY MANAGEMENT</span>
          <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        </div>

        <input
          className="cm-search"
          type="text"
          placeholder="search cities…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />

        <div className="cm-table">
          <div className="cm-header-row">
            <span className="cm-header-cell">CITY</span>
            <span className="cm-header-cell cm-header-cell--center">PLACES</span>
            <span className="cm-header-cell">COUNTRIES</span>
          </div>

          {filteredList.map(city => {
            const isSelected    = selectedCity?.display === city.display;
            const isMulti       = city.countries.size > 1;
            const countriesText = city.countries.size === 0
              ? '—'
              : [...city.countries].join(', ');

            return (
              <div
                key={city.display || '__empty__'}
                className={[
                  'cm-row',
                  !city.display  ? 'cm-row--empty'    : '',
                  isSelected     ? 'cm-row--selected'  : '',
                ].filter(Boolean).join(' ')}
                onClick={() => selectCity(city)}
                role="row"
                aria-selected={isSelected}
              >
                <span className="cm-city">{city.display || '(no city)'}</span>
                <span className="cm-count">{city.count}</span>
                <span className={`cm-countries${isMulti ? ' cm-countries--warn' : ''}`}>
                  {countriesText}{isMulti ? ' ⚠' : ''}
                </span>
              </div>
            );
          })}

          {filteredList.length === 0 && (
            <div className="cm-empty">no cities match</div>
          )}
        </div>

        {selectedCity !== null && (
          <div className="cm-actions">
            <div className="cm-actions-label">
              {selectedCity.display || '(no city)'} · {selectedCity.count} place{selectedCity.count !== 1 ? 's' : ''}
            </div>

            <div className="cm-action-row">
              <span className="cm-action-label">RENAME TO</span>
              <input
                className="cm-input"
                type="text"
                value={renameVal}
                onChange={e => setRenameVal(e.target.value)}
                placeholder="new city name"
                disabled={busy}
              />
              <button
                className="cm-btn"
                disabled={busy || !renameVal.trim() || renameVal.trim() === selectedCity.display}
                onClick={handleRename}
              >RENAME</button>
            </div>

            <div className="cm-action-row">
              <span className="cm-action-label">MERGE INTO</span>
              <input
                className="cm-input"
                type="text"
                value={mergeSearch}
                onChange={e => setMergeSearch(e.target.value)}
                placeholder="search target city…"
                disabled={busy}
              />
            </div>
            {mergeSearch.length > 0 && (
              <div className="cm-merge-list">
                {cityList
                  .filter(c => c.display !== selectedCity.display &&
                    c.display.toLowerCase().includes(mergeSearch.toLowerCase()))
                  .slice(0, 6)
                  .map(c => (
                    <button
                      key={c.display || '__empty__'}
                      className="cm-merge-option"
                      onClick={() => handleMerge(c.display)}
                      disabled={busy}
                    >
                      {c.display || '(no city)'} ({c.count})
                    </button>
                  ))
                }
              </div>
            )}

            {selectedCity.countries.size > 1 && (
              <div className="cm-warning">
                <span>⚠ appears under {selectedCity.countries.size} country groups — set country for all:</span>
                <input
                  className="cm-input cm-input--narrow"
                  type="text"
                  value={fixCountry}
                  onChange={e => setFixCountry(e.target.value)}
                  placeholder="country name"
                  disabled={busy}
                />
                <button
                  className="cm-btn"
                  onClick={handleFixCountry}
                  disabled={busy || !fixCountry.trim()}
                >APPLY</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
