import { useRef, useState, useMemo } from 'react';
import { getAllPlaces, mergeCities, setCountryForCity } from '../db/repo.js';
import './CitiesModal.css';

function entryKey(display, country) {
  return `${display.toLowerCase()}|${country}`;
}

// Groups by city + country combined, so "Arad, Romania" and "Arad, Israel"
// are separate rows instead of colliding under one city name.
function buildCityList(places) {
  const byKey = new Map();
  places.forEach(p => {
    const display = p.city || '';
    const country = p.country || '';
    const key = entryKey(display, country);
    if (!byKey.has(key)) byKey.set(key, { display, country, count: 0 });
    byKey.get(key).count++;
  });

  // Flag city names that appear under more than one country — informational only.
  const nameCounts = new Map();
  for (const entry of byKey.values()) {
    if (!entry.display) continue;
    const n = entry.display.toLowerCase();
    nameCounts.set(n, (nameCounts.get(n) || 0) + 1);
  }

  return [...byKey.values()]
    .map(entry => ({ ...entry, hasDuplicate: nameCounts.get(entry.display.toLowerCase()) > 1 }))
    .sort((a, b) => {
      const aEmpty = !a.country, bEmpty = !b.country;
      if (aEmpty && !bEmpty) return -1;
      if (!aEmpty && bEmpty) return 1;
      if (a.country !== b.country) return a.country.localeCompare(b.country);
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
    if (selectedCity && entryKey(selectedCity.display, selectedCity.country) === entryKey(city.display, city.country)) {
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
            const isSelected = selectedCity &&
              entryKey(selectedCity.display, selectedCity.country) === entryKey(city.display, city.country);

            return (
              <div
                key={entryKey(city.display, city.country)}
                className={[
                  'cm-row',
                  !city.display  ? 'cm-row--empty'    : '',
                  isSelected     ? 'cm-row--selected'  : '',
                ].filter(Boolean).join(' ')}
                onClick={() => selectCity(city)}
                role="row"
                aria-selected={isSelected}
              >
                <span className="cm-city">
                  {city.display || '(no city)'}
                  {city.hasDuplicate && <span className="cm-tag">· shared name</span>}
                </span>
                <span className="cm-count">{city.count}</span>
                <span className="cm-countries">{city.country || '—'}</span>
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
              {selectedCity.display || '(no city)'}{selectedCity.country ? `, ${selectedCity.country}` : ''} · {selectedCity.count} place{selectedCity.count !== 1 ? 's' : ''}
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
                  .filter(c => entryKey(c.display, c.country) !== entryKey(selectedCity.display, selectedCity.country) &&
                    (c.display.toLowerCase().includes(mergeSearch.toLowerCase()) ||
                     c.country.toLowerCase().includes(mergeSearch.toLowerCase())))
                  .slice(0, 6)
                  .map(c => (
                    <button
                      key={entryKey(c.display, c.country)}
                      className="cm-merge-option"
                      onClick={() => handleMerge(c.display)}
                      disabled={busy}
                    >
                      {c.display || '(no city)'}{c.country ? `, ${c.country}` : ''} ({c.count})
                    </button>
                  ))
                }
                <div className="cm-note">
                  Merge moves all places named '{selectedCity.display || '(no city)'}'
                  {selectedCity.country ? ` in ${selectedCity.country}` : ''} to the target city.
                </div>
              </div>
            )}

            {!selectedCity.country && (
              <div className="cm-warning">
                <span>set a country for these places:</span>
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
