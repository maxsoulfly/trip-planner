import { useEffect, useMemo, useState } from 'react';
import { getAllPlaces, deletePlace, getAllTrips, deleteTripCascade } from './db/repo.js';
import { PLACE_TYPES, STATUSES } from './db/constants.js';
import PlaceCard from './components/PlaceCard.jsx';
import PlaceList from './components/PlaceList.jsx';
import PlaceForm from './components/PlaceForm.jsx';
import CsvImport   from './components/CsvImport.jsx';
import XlsxImport  from './components/XlsxImport.jsx';
import AdminModal  from './components/AdminModal.jsx';
import TripList    from './components/TripList.jsx';
import TripForm  from './components/TripForm.jsx';
import TripGrid  from './components/TripGrid.jsx';
import './App.css';

const THEME_CYCLE = ['dark', 'light', 'system'];
const THEME_LABEL = { dark: '◐ DARK', light: '☀ LIGHT', system: '⊙ SYS' };

function isIncomplete(p) {
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
//   modal:       null | { mode: 'add' } | { mode: 'edit', place }  — place form
//   showImport:  bool                                                — csv import
//   tripModal:   null | { mode: 'add' } | { mode: 'edit', trip }   — trip form

export default function App() {
  const [places,       setPlaces]       = useState([]);
  const [trips,        setTrips]        = useState([]);
  const [view,         setView]         = useState('places');
  const [activeTrip,   setActiveTrip]   = useState(null);
  const [search,       setSearch]       = useState('');
  const [filterCity,   setFilterCity]   = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [listView,     setListView]     = useState(false);
  const [modal,        setModal]        = useState(null);
  const [showImport,       setShowImport]       = useState(false);
  const [showXlsx,         setShowXlsx]         = useState(false);
  const [showAdmin,        setShowAdmin]        = useState(false);
  const [filterIncomplete, setFilterIncomplete] = useState(false);
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
    setShowImport(false);
    setShowXlsx(false);
    setShowAdmin(false);
  }

  // ── Place library helpers ─────────────────────────────────────────────────

  const cities = useMemo(() => {
    const set = new Set(places.map((p) => p.city).filter(Boolean));
    return [...set].sort();
  }, [places]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => {
      if (filterCity       && p.city   !== filterCity)   return false;
      if (filterType       && p.type   !== filterType)   return false;
      if (filterStatus     && p.status !== filterStatus) return false;
      if (filterIncomplete && !isIncomplete(p))          return false;
      if (q && ![p.name, p.city, p.country, p.notes, ...(p.tags || [])]
        .join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [places, search, filterCity, filterType, filterStatus, filterIncomplete]);

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
            <span className="library-sub">local cache · all cities</span>
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
            <select className="toolbar__select" value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)} aria-label="Filter by city">
              <option value="">ALL CITIES</option>
              {cities.map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
            </select>
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
            <button
              className={`btn-import${filterIncomplete ? ' btn-import--active' : ''}`}
              onClick={() => setFilterIncomplete(v => !v)}
              aria-pressed={filterIncomplete}
            >
              ⚠ INCOMPLETE
            </button>

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

            <button className="btn-add" onClick={() => setModal({ mode: 'add' })}>
              + ADD PLACE
            </button>
            <button className="btn-import" onClick={() => setShowImport(true)}>
              IMPORT CSV
            </button>
            <button className="btn-import" onClick={() => setShowXlsx(true)}>
              IMPORT XLSX
            </button>
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

      {showImport && (
        <CsvImport
          onDone={() => { setShowImport(false); loadPlaces(); }}
          onClose={() => setShowImport(false)}
        />
      )}

      {showXlsx && (
        <XlsxImport
          onDone={() => { setShowXlsx(false); loadPlaces(); }}
          onClose={() => setShowXlsx(false)}
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
    </div>
  );
}
