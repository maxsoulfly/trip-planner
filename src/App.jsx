import { useEffect, useState } from 'react';
import {
  getAllPlaces,
  getAllTrips,
  getScheduleForTrip,
  resetAll,
  counts,
} from './db/repo.js';
import { seedDummyData } from './db/seed.js';
import { typeMeta, blockMeta, statusMeta, BLOCKS } from './db/constants.js';
import { hoursSummary } from './utils/hours.js';

// ---------------------------------------------------------------------------
// STEP 1 — Round-trip smoke test.
//
// This screen is throwaway plumbing whose only job is to PROVE the data layer
// works: write records to IndexedDB, read them back, and resolve relations
// (schedule item -> place). The real place-library UI is step 2.
//
// The most important test you can run here: click "Seed", then RELOAD the
// browser tab. If the data is still there, persistence works (it's in
// IndexedDB, not just React state).
// ---------------------------------------------------------------------------

export default function App() {
  const [places, setPlaces] = useState([]);
  const [trip, setTrip] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [stats, setStats] = useState({ places: 0, trips: 0, scheduleItems: 0 });
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [allPlaces, allTrips, c] = await Promise.all([
      getAllPlaces(),
      getAllTrips(),
      counts(),
    ]);
    setPlaces(allPlaces);
    setStats(c);
    const firstTrip = allTrips[0] || null;
    setTrip(firstTrip);
    setSchedule(firstTrip ? await getScheduleForTrip(firstTrip.id) : []);
  }

  // Read whatever is already in IndexedDB on first render.
  useEffect(() => {
    loadAll();
  }, []);

  async function handleSeed() {
    setBusy(true);
    await seedDummyData();
    await loadAll();
    setBusy(false);
  }

  async function handleClear() {
    setBusy(true);
    await resetAll();
    await loadAll();
    setBusy(false);
  }

  const placeById = Object.fromEntries(places.map((p) => [p.id, p]));
  const hasData = stats.places > 0 || stats.trips > 0;

  return (
    <div className="app">
      <header className="topbar">
        <div>
          <h1>Trip Planner</h1>
          <p className="muted">Step 1 — data layer round-trip test</p>
        </div>
        <div className="actions">
          <button onClick={handleSeed} disabled={busy}>Seed dummy data</button>
          <button onClick={handleClear} disabled={busy} className="ghost">Clear all</button>
        </div>
      </header>

      <div className="statusline">
        <span className={hasData ? 'ok' : 'muted'}>
          {hasData ? '✓ data in IndexedDB' : 'empty — click “Seed dummy data”'}
        </span>
        <span className="muted">
          {stats.places} places · {stats.trips} trips · {stats.scheduleItems} schedule items
        </span>
        <span className="muted hint">Tip: after seeding, reload the page — data should persist.</span>
      </div>

      <main className="grid">
        {/* ---- Places library (read-back) ---- */}
        <section className="card">
          <h2>Place library</h2>
          {places.length === 0 && <p className="muted">No places yet.</p>}
          <ul className="list">
            {places.map((p) => {
              const t = typeMeta(p.type);
              const s = statusMeta(p.status);
              return (
                <li key={p.id}>
                  <div className="row">
                    <span className="name">{t.emoji} {p.name}</span>
                    <span className="pill">{s.emoji} {s.label}</span>
                  </div>
                  <div className="meta">
                    {t.label} · {p.city}, {p.country}
                  </div>
                  <div className="meta">{hoursSummary(p.openingHours)}</div>
                  {p.googleMapsUrl && (
                    <a href={p.googleMapsUrl} target="_blank" rel="noreferrer">
                      Open in Google Maps ↗
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {/* ---- Trip + flights (read-back) ---- */}
        <section className="card">
          <h2>Trip</h2>
          {!trip && <p className="muted">No trip yet.</p>}
          {trip && (
            <>
              <h3>{trip.title}</h3>
              <div className="meta">
                {trip.cities.join(', ')} · {trip.startDate} → {trip.endDate}
              </div>
              {trip.outboundFlight && (
                <div className="flight">
                  ✈ Out: {trip.outboundFlight.from} → {trip.outboundFlight.to} ·{' '}
                  {trip.outboundFlight.number}
                </div>
              )}
              {trip.inboundFlight && (
                <div className="flight">
                  ✈ Back: {trip.inboundFlight.from} → {trip.inboundFlight.to} ·{' '}
                  {trip.inboundFlight.number}
                </div>
              )}
            </>
          )}
        </section>

        {/* ---- Schedule, grouped by date then block (relations resolved) ---- */}
        <section className="card wide">
          <h2>Schedule</h2>
          {schedule.length === 0 && <p className="muted">No schedule items yet.</p>}
          {groupByDate(schedule).map(([date, itemsForDate]) => (
            <div key={date} className="day">
              <h3>{date}</h3>
              {BLOCKS.map((b) => {
                const items = itemsForDate
                  .filter((it) => it.block === b.key)
                  .sort((a, c) => a.order - c.order);
                if (items.length === 0) return null;
                return (
                  <div key={b.key} className="block">
                    <span className="blocklabel">{b.emoji} {b.label}</span>
                    <ul className="list tight">
                      {items.map((it) => (
                        <li key={it.id}>
                          {it.kind === 'place'
                            ? renderPlaceItem(placeById[it.placeId])
                            : (it.adHoc?.label || it.kind)}
                          {it.notes && <span className="muted"> — {it.notes}</span>}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}

// Resolve a schedule item's place into a readable line; guards missing refs.
function renderPlaceItem(place) {
  if (!place) return '⚠ (missing place)';
  return `${typeMeta(place.type).emoji} ${place.name}`;
}

// Group schedule items by date, returned as sorted [date, items] pairs.
function groupByDate(items) {
  const map = {};
  for (const it of items) (map[it.date] ||= []).push(it);
  return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
}
