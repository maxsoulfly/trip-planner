import { useEffect, useMemo, useState } from 'react';
import { getAllPlaces, deletePlace, getAllTrips, deleteTripCascade } from './db/repo.js';
import { PLACE_TYPES, STATUSES } from './db/constants.js';
import PlaceCard from './components/PlaceCard.jsx';
import PlaceForm from './components/PlaceForm.jsx';
import CsvImport from './components/CsvImport.jsx';
import TripList  from './components/TripList.jsx';
import TripForm  from './components/TripForm.jsx';
import TripGrid  from './components/TripGrid.jsx';
import './App.css';

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
  const [modal,        setModal]        = useState(null);
  const [showImport,   setShowImport]   = useState(false);
  const [tripModal,    setTripModal]    = useState(null);

  async function loadPlaces() { setPlaces(await getAllPlaces()); }
  async function loadTrips()  { setTrips(await getAllTrips());   }

  useEffect(() => { loadPlaces(); loadTrips(); }, []);

  function switchView(v) {
    setView(v);
    setActiveTrip(null);
    // Close any open modals belonging to the other view.
    setModal(null);
    setShowImport(false);
  }

  // ── Place library helpers ─────────────────────────────────────────────────

  const cities = useMemo(() => {
    const set = new Set(places.map((p) => p.city).filter(Boolean));
    return [...set].sort();
  }, [places]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return places.filter((p) => {
      if (filterCity   && p.city   !== filterCity)   return false;
      if (filterType   && p.type   !== filterType)   return false;
      if (filterStatus && p.status !== filterStatus) return false;
      if (q && ![p.name, p.city, p.country, p.notes, ...(p.tags || [])]
        .join(' ').toLowerCase().includes(q)) return false;
      return true;
    });
  }, [places, search, filterCity, filterType, filterStatus]);

  async function handleDeletePlace(place) {
    if (!window.confirm(`Delete "${place.name}"? This cannot be undone.`)) return;
    await deletePlace(place.id);
    await loadPlaces();
  }

  function handlePlaceSaved() { setModal(null); loadPlaces(); }

  // ── Trip helpers ──────────────────────────────────────────────────────────

  async function handleDeleteTrip(trip) {
    if (!window.confirm(`Delete "${trip.title}"? This also deletes all its schedule items.`)) return;
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
            <button className="btn-add" onClick={() => setModal({ mode: 'add' })}>
              + ADD PLACE
            </button>
            <button className="btn-import" onClick={() => setShowImport(true)}>
              IMPORT CSV
            </button>
          </div>

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
                onEdit={() => setModal({ mode: 'edit', place: p })}
                onDelete={() => handleDeletePlace(p)}
              />
            ))}
          </main>
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

      {tripModal && (
        <TripForm
          initialData={tripModal.mode === 'edit' ? tripModal.trip : null}
          onSave={handleTripSaved}
          onClose={() => setTripModal(null)}
        />
      )}
    </div>
  );
}
