import { useEffect, useMemo, useRef, useState } from 'react';
import { getAllPlaces, deletePlace, getAllTrips, deleteTripCascade } from './db/repo.js';
import { PLACE_TYPES, STATUSES, VENUE_TRAITS } from './db/constants.js';
import PlaceCard from './components/PlaceCard.jsx';
import PlaceList from './components/PlaceList.jsx';
import PlaceForm from './components/PlaceForm.jsx';
import AdminModal  from './components/AdminModal.jsx';
import BulkPaste  from './components/BulkPaste.jsx';
import TripList    from './components/TripList.jsx';
import TripForm  from './components/TripForm.jsx';
import TripGrid  from './components/TripGrid.jsx';
import './App.css';

const parseTags = (str) => (str ? String(str).split(',').map((s) => s.trim()).filter(Boolean) : []);

const THEME_CYCLE = ['dark', 'light', 'system'];
const THEME_LABEL = { dark: '◐ DARK', light: '☀ LIGHT', system: '⊙ SYS' };

function isIncomplete(p) {
  if (p.status === 'permanently_closed') return false;
  if (p.type === 'other') return true;
  const hoursTypes = ['taproom','bottle_shop','brewpub','bar',
                      'restaurant','cafe','museum','activity','shop'];
  if (hoursTypes.includes(p.type) &&
      Object.keys(p.openingHours || {}).length === 0) return true;
  return false;
}

// Top-level view state:
//   view:       'places' | 'trips'
//   activeTrip: null | Trip   (null = show list; Trip = show grid)
//
// Modal state:
//   modal:              null | { mode: 'add' } | { mode: 'edit', place }  — place form
//   showBulkPasteModal: bool  — bulk paste modal (launched from split button)
//   tripModal:          null | { mode: 'add' } | { mode: 'edit', trip }   — trip form

export default function App() {
  const [places,       setPlaces]       = useState([]);
  const [trips,        setTrips]        = useState([]);
  const [view,         setView]         = useState('places');
  const [activeTrip,   setActiveTrip]   = useState(null);
  const [search,       setSearch]       = useState('');
  const [filterCity,   setFilterCity]   = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTrait,  setFilterTrait]  = useState('');
  const [listView,     setListView]     = useState(false);
  const [modal,               setModal]               = useState(null);
  const [showAdmin,           setShowAdmin]           = useState(false);
  const [showBulkDropdown,    setShowBulkDropdown]    = useState(false);
  const [showBulkPasteModal,  setShowBulkPasteModal]  = useState(false);
  const [filterIncomplete,    setFilterIncomplete]    = useState(false);

  const splitBtnRef = useRef(null);
  const cityDdRef   = useRef(null);
  const [showCityDd,  setShowCityDd]  = useState(false);
  const [citySearch,  setCitySearch]  = useState('');
  const [tripModal,        setTripModal]        = useState(null);
  const [theme,            setThemeState]       = useState(
    () => document.documentElement.getAttribute('data-theme') || 'dark'
  );

  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    localStorage.setItem('theme', t);
    setThemeState(t);
  }

  function cycleTheme() {
    const idx = THEME_CYCLE.indexOf(theme);
    setTheme(THEME_CYCLE[(idx + 1) % THEME_CYCLE.length]);
  }

  async function loadPlaces() { setPlaces(await getAllPlaces()); }
  async function loadTrips()  { setTrips(await getAllTrips());   }

  useEffect(() => { loadPlaces(); loadTrips(); }, []);

  function switchView(v) {
    setView(v);
    setActiveTrip(null);
    setModal(null);
    setShowAdmin(false);
    setShowBulkDropdown(false);
    setShowBulkPasteModal(false);
  }

  // ── Place library helpers ─────────────────────────────────────────────────

  const cityGroups = useMemo(() => {
    const seen = new Map();
    places.forEach(p => {
      const key = `${p.city || ''}|${p.state || ''}|${p.country || ''}`;
      if (!seen.has(key)) seen.set(key, {
        value: p.city || '',
        label: (p.city || '') + (p.state ? `, ${p.state}` : ''),
        country: p.country || '',
      });
    });
    const byCountry = new Map();
    for (const entry of seen.values()) {
      if (!entry.value) continue; // skip blank city entries
      const c = entry.country;
      if (!byCountry.has(c)) byCountry.set(c, []);
      byCountry.get(c).push(entry);
    }
    return [...byCountry.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([country, cities]) => ({
        country,
        cities: cities.sort((a, b) => a.label.localeCompare(b.label)),
      }));
  }, [places]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => {
      if (filterCity       && p.city   !== filterCity)   return false;
      if (filterType       && p.type   !== filterType)   return false;
      if (filterStatus     && p.status !== filterStatus) return false;
      if (filterTrait      && !(p.tags || []).includes(filterTrait)) return false;
      if (filterIncomplete && !isIncomplete(p))          return false;
      if (q && ![p.name, p.city, p.country, p.notes, ...(p.tags || [])]
        .join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [places, search, filterCity, filterType, filterStatus, filterTrait, filterIncomplete]);

  const incompleteCount = useMemo(() => places.filter(isIncomplete).length, [places]);

  // Close city dropdown on outside click or Escape.
  useEffect(() => {
    if (!showCityDd) return;
    function handleOutside(e) {
      if (cityDdRef.current && !cityDdRef.current.contains(e.target)) {
        setShowCityDd(false); setCitySearch('');
      }
    }
    function handleEsc(e) {
      if (e.key === 'Escape') { setShowCityDd(false); setCitySearch(''); }
    }
    document.addEventListener('click', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('click', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [showCityDd]);

  // Close bulk-paste dropdown when user clicks outside the split button group.
  useEffect(() => {
    if (!showBulkDropdown) return;
    function handleOutside(e) {
      if (splitBtnRef.current && !splitBtnRef.current.contains(e.target)) {
        setShowBulkDropdown(false);
      }
    }
    document.addEventListener('click', handleOutside);
    return () => document.removeEventListener('click', handleOutside);
  }, [showBulkDropdown]);

  // Inline confirm is now handled inside PlaceCard — handler just deletes.
  async function handleDeletePlace(place) {
    await deletePlace(place.id);
    await loadPlaces();
  }

  async function handleBulkDelete(ids) {
    await Promise.all(ids.map((id) => deletePlace(id)));
    await loadPlaces();
  }

  function handlePlaceSaved() { setModal(null); loadPlaces(); }

  // ── Trip helpers ──────────────────────────────────────────────────────────

  // Inline confirm handled inside TripCard — handler just deletes.
  async function handleDeleteTrip(trip) {
    await deleteTripCascade(trip.id);
    await loadTrips();
  }

  function handleTripSaved() { setTripModal(null); loadTrips(); }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="app">

      {/* ── Status bar + tab switcher ───────────────────────────────── */}
      <div className="statusbar">
        <span>
          <span className="statusbar__dot">●</span>
          {' LOCAL ONLY · '}
          <span className="statusbar__count">{places.length} PLACES</span>
          {' · '}
          <span className="statusbar__count">{trips.length} TRIPS</span>
          {incompleteCount > 0 && (
            <button
              className={`statusbar-incomplete${filterIncomplete ? ' statusbar-incomplete--on' : ''}`}
              onClick={() => setFilterIncomplete(f => !f)}
              aria-pressed={filterIncomplete}
            >
              ⚠ {incompleteCount} INCOMPLETE
            </button>
          )}
        </span>
        <div className="statusbar-right">
          <button className="btn-theme" onClick={cycleTheme} aria-label="Toggle theme">
            {THEME_LABEL[theme]}
          </button>
          <button className="btn-admin" onClick={() => setShowAdmin(true)} aria-label="Admin">⚙ ADMIN</button>
          <div className="tab-switcher">
            <button
              className={`tab-btn ${view === 'places' ? 'tab-btn--active' : ''}`}
              onClick={() => switchView('places')}
            >PLACES</button>
            <button
              className={`tab-btn ${view === 'trips' ? 'tab-btn--active' : ''}`}
              onClick={() => switchView('trips')}
            >TRIPS</button>
          </div>
        </div>
      </div>

      {/* ── PLACES VIEW ────────────────────────────────────────────────────── */}
      {view === 'places' && (
        <>
          <div className="library-head">
            <span className="library-mark">
              PLACE LIBRARY<span className="library-slash">//</span>
            </span>
            <span className="library-sub">{[
              'LOCAL CACHE',
              filterCity || 'ALL CITIES',
              filterType   ? (PLACE_TYPES.find(t => t.key === filterType)?.label   || filterType).toUpperCase()  : null,
              filterTrait  ? (VENUE_TRAITS.find(t => t.key === filterTrait)?.label || filterTrait).toUpperCase() : null,
              filterStatus ? filterStatus.toUpperCase() : null,
            ].filter(Boolean).join(' · ')}</span>
          </div>

          <div className="toolbar">
            <input
              className="toolbar__search"
              type="search"
              placeholder="SEARCH PLACES…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search places"
            />
            {/* Custom city dropdown — grouped by country, city+state label */}
            {(() => {
              const cityDdLabel = filterCity
                ? cityGroups.flatMap(g => g.cities).find(c => c.value === filterCity)?.label || filterCity
                : 'ALL CITIES';
              return (
                <div className="city-dd" ref={cityDdRef}>
                  <button
                    className={`city-dd-btn${filterCity ? ' city-dd-btn--active' : ''}`}
                    onClick={() => setShowCityDd(s => !s)}
                    aria-haspopup="listbox"
                    aria-expanded={showCityDd}
                    aria-label="Filter by city"
                  >
                    <span>{cityDdLabel}</span>
                    <span className="city-dd-chevron">▾</span>
                  </button>
                  {showCityDd && (
                    <div className="city-dd-panel" role="listbox">
                      <input
                        className="city-dd-search"
                        type="text"
                        placeholder="search cities..."
                        value={citySearch}
                        onChange={e => setCitySearch(e.target.value)}
                        onClick={e => e.stopPropagation()}
                        autoFocus
                      />
                      <button
                        className={`city-dd-option${!filterCity ? ' city-dd-option--selected' : ''}`}
                        role="option" aria-selected={!filterCity}
                        onClick={() => { setFilterCity(''); setShowCityDd(false); setCitySearch(''); }}
                      >
                        All cities
                      </button>
                      {cityGroups.map(group => {
                        const visibleCities = citySearch
                          ? group.cities.filter(c => c.label.toLowerCase().includes(citySearch.toLowerCase()))
                          : group.cities;
                        if (!visibleCities.length) return null;
                        return (
                          <div key={group.country}>
                            <div className="city-dd-group">{group.country || 'Unknown'}</div>
                            {visibleCities.map(c => (
                              <button
                                key={c.value + '|' + c.label}
                                className={`city-dd-option city-dd-option--indented${filterCity === c.value ? ' city-dd-option--selected' : ''}`}
                                role="option" aria-selected={filterCity === c.value}
                                onClick={() => { setFilterCity(c.value); setShowCityDd(false); setCitySearch(''); }}
                              >
                                {c.label}
                              </button>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
            <select className="toolbar__select" value={filterType}
              onChange={(e) => setFilterType(e.target.value)} aria-label="Filter by type">
              <option value="">ALL TYPES</option>
              {PLACE_TYPES.map((t) => (
                <option key={t.key} value={t.key}>{t.emoji} {t.label.toUpperCase()}</option>
              ))}
            </select>
            <select className="toolbar__select" value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)} aria-label="Filter by status">
              <option value="">ALL STATUS</option>
              {STATUSES.map((s) => (
                <option key={s.key} value={s.key}>{s.emoji} {s.label.toUpperCase()}</option>
              ))}
            </select>
            <select className="toolbar__select" value={filterTrait}
              onChange={(e) => setFilterTrait(e.target.value)} aria-label="Filter by trait">
              <option value="">ALL TRAITS</option>
              {VENUE_TRAITS.map((t) => (
                <option key={t.key} value={t.key}>{t.emoji} {t.label.toUpperCase()}</option>
              ))}
            </select>
            {/* View toggle */}
            <div className="btn-view-group">
              <button
                className={`btn-view ${!listView ? 'btn-view--active' : ''}`}
                onClick={() => setListView(false)}
                aria-pressed={!listView}
              >CARDS</button>
              <button
                className={`btn-view ${listView ? 'btn-view--active' : ''}`}
                onClick={() => setListView(true)}
                aria-pressed={listView}
              >LIST</button>
            </div>

            {/* Split button: + ADD PLACE | ▾ dropdown → bulk paste */}
            <div className="split-btn-group" ref={splitBtnRef}>
              <button
                className="split-btn-primary"
                onClick={() => setModal({ mode: 'add' })}
              >
                + ADD PLACE
              </button>
              <button
                className="split-btn-chevron"
                onClick={() => setShowBulkDropdown(s => !s)}
                aria-label="More add options"
              >
                ▾
              </button>
              {showBulkDropdown && (
                <div className="split-btn-dropdown">
                  <button
                    className="split-btn-option"
                    onClick={() => { setShowBulkDropdown(false); setShowBulkPasteModal(true); }}
                  >
                    + BULK PASTE
                  </button>
                </div>
              )}
            </div>
          </div>

          {listView ? (
            <PlaceList
              places={filtered}
              onEdit={(p) => setModal({ mode: 'edit', place: p })}
              onBulkDelete={handleBulkDelete}
            />
          ) : (
            <main className="cards-grid" aria-live="polite" aria-label="Place library">
              {filtered.length === 0 && (
                <p className="empty-state">
                  {places.length === 0
                    ? 'No places yet — add your first.'
                    : 'No matches. Try adjusting the filters.'}
                </p>
              )}
              {filtered.map((p) => (
                <PlaceCard
                  key={p.id}
                  place={p}
                  incomplete={isIncomplete(p)}
                  onEdit={() => setModal({ mode: 'edit', place: p })}
                  onDelete={() => handleDeletePlace(p)}
                />
              ))}
            </main>
          )}
        </>
      )}

      {/* ── TRIPS VIEW — list ──────────────────────────────────────────────── */}
      {view === 'trips' && !activeTrip && (
        <TripList
          trips={trips}
          onNew={() => setTripModal({ mode: 'add' })}
          onEdit={(t) => setTripModal({ mode: 'edit', trip: t })}
          onDelete={handleDeleteTrip}
          onOpen={setActiveTrip}
        />
      )}

      {/* ── TRIPS VIEW — grid ─────────────────────────────────────────────── */}
      {view === 'trips' && activeTrip && (
        <TripGrid
          trip={activeTrip}
          onBack={() => setActiveTrip(null)}
        />
      )}

      {/* ── Modals ─────────────────────────────────────────────────────────── */}

      {modal && (
        <PlaceForm
          initialData={modal.mode === 'edit' ? modal.place : null}
          onSave={handlePlaceSaved}
          onClose={() => setModal(null)}
        />
      )}

      {tripModal && (
        <TripForm
          initialData={tripModal.mode === 'edit' ? tripModal.trip : null}
          onSave={handleTripSaved}
          onClose={() => setTripModal(null)}
        />
      )}

      {showAdmin && (
        <AdminModal
          onRefresh={() => { loadPlaces(); loadTrips(); }}
          onClose={() => setShowAdmin(false)}
        />
      )}

      {showBulkPasteModal && (
        <BulkPaste
          existingPlaces={places}
          cityFilter={filterCity}
          onImport={() => { setShowBulkPasteModal(false); loadPlaces(); }}
          onClose={() => setShowBulkPasteModal(false)}
        />
      )}
    </div>
  );
}
