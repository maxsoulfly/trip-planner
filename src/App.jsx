import { useEffect, useMemo, useState } from 'react';
import { getAllPlaces, deletePlace } from './db/repo.js';
import { PLACE_TYPES, STATUSES } from './db/constants.js';
import PlaceCard from './components/PlaceCard.jsx';
import PlaceForm from './components/PlaceForm.jsx';
import CsvImport from './components/CsvImport.jsx';
import './App.css';

// modal state shapes:
//   null                      — closed
//   { mode: 'add' }           — new place form
//   { mode: 'edit', place }   — edit existing place

export default function App() {
  const [places,       setPlaces]       = useState([]);
  const [search,       setSearch]       = useState('');
  const [filterCity,   setFilterCity]   = useState('');
  const [filterType,   setFilterType]   = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modal,        setModal]        = useState(null);
  const [showImport,   setShowImport]   = useState(false);

  async function loadPlaces() {
    setPlaces(await getAllPlaces());
  }

  useEffect(() => { loadPlaces(); }, []);

  // Unique city list derived from current library — drives the city dropdown.
  const cities = useMemo(() => {
    const set = new Set(places.map((p) => p.city).filter(Boolean));
    return [...set].sort();
  }, [places]);

  // Client-side filter — fast enough for hundreds of records.
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

  async function handleDelete(place) {
    if (!window.confirm(`Delete "${place.name}"? This cannot be undone.`)) return;
    await deletePlace(place.id);
    await loadPlaces();
  }

  function handleSaved() {
    setModal(null);
    loadPlaces();
  }

  return (
    <div className="app">

      {/* ── Status bar ─────────────────────────────────────────────── */}
      <div className="statusbar">
        <span>
          <span className="statusbar__dot">●</span>
          {' LOCAL ONLY · '}
          <span className="statusbar__count">{places.length} CACHES</span>
        </span>
        <span className="statusbar__right">FIELD TERMINAL</span>
      </div>

      {/* ── Page heading ───────────────────────────────────────────── */}
      <div className="library-head">
        <span className="library-mark">
          PLACE LIBRARY<span className="library-slash">//</span>
        </span>
        <span className="library-sub">local cache · all cities</span>
      </div>

      {/* ── Search + filter toolbar ────────────────────────────────── */}
      <div className="toolbar">
        <input
          className="toolbar__search"
          type="search"
          placeholder="SEARCH CACHES…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search places"
        />

        <select
          className="toolbar__select"
          value={filterCity}
          onChange={(e) => setFilterCity(e.target.value)}
          aria-label="Filter by city"
        >
          <option value="">ALL CITIES</option>
          {cities.map((c) => (
            <option key={c} value={c}>{c.toUpperCase()}</option>
          ))}
        </select>

        <select
          className="toolbar__select"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          aria-label="Filter by type"
        >
          <option value="">ALL TYPES</option>
          {PLACE_TYPES.map((t) => (
            <option key={t.key} value={t.key}>{t.emoji} {t.label.toUpperCase()}</option>
          ))}
        </select>

        <select
          className="toolbar__select"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          aria-label="Filter by status"
        >
          <option value="">ALL STATUS</option>
          {STATUSES.map((s) => (
            <option key={s.key} value={s.key}>{s.emoji} {s.label.toUpperCase()}</option>
          ))}
        </select>

        <button className="btn-add" onClick={() => setModal({ mode: 'add' })}>
          + ADD CACHE
        </button>
        <button className="btn-import" onClick={() => setShowImport(true)}>
          IMPORT CSV
        </button>
      </div>

      {/* ── Cards grid ─────────────────────────────────────────────── */}
      <main className="cards-grid" aria-live="polite" aria-label="Place library">
        {filtered.length === 0 && (
          <p className="empty-state">
            {places.length === 0
              ? 'No caches yet — add your first place.'
              : 'No matches. Try adjusting the filters.'}
          </p>
        )}
        {filtered.map((p) => (
          <PlaceCard
            key={p.id}
            place={p}
            onEdit={() => setModal({ mode: 'edit', place: p })}
            onDelete={() => handleDelete(p)}
          />
        ))}
      </main>

      {/* ── Add / Edit modal ───────────────────────────────────────── */}
      {modal && (
        <PlaceForm
          initialData={modal.mode === 'edit' ? modal.place : null}
          onSave={handleSaved}
          onClose={() => setModal(null)}
        />
      )}

      {/* ── CSV import modal ───────────────────────────────────────── */}
      {showImport && (
        <CsvImport
          onDone={() => { setShowImport(false); loadPlaces(); }}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
