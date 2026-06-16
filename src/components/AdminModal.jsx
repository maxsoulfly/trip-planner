import { useEffect, useRef, useState } from 'react';
import {
  clearAllPlaces, clearAllTrips, clearAllData,
  exportAll, importAll,
  getAllPlaces, mergeCities,
} from '../db/repo.js';
import './AdminModal.css';

export default function AdminModal({ onRefresh, onClose }) {
  const [pending, setPending] = useState(null); // null | 'clearPlaces' | 'clearTrips' | 'clearAll'
  const [busy,    setBusy]    = useState(false);
  const [message, setMessage] = useState(null); // { ok, text }

  const [cities,          setCities]          = useState([]);
  const [sourceCityMerge, setSourceCityMerge] = useState('');
  const [targetCityMerge, setTargetCityMerge] = useState('');
  const [mergePending,    setMergePending]    = useState(false);

  const fileRef         = useRef(null);
  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);

  useEffect(() => {
    getAllPlaces().then((places) => {
      const citySet = new Set(places.map((p) => p.city).filter(Boolean));
      setCities([...citySet].sort());
    });
  }, []);

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current && !busy) onClose();
  }

  async function run(fn) {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      onRefresh();
      setMessage({ ok: true, text: 'Done.' });
    } catch (err) {
      setMessage({ ok: false, text: err.message || 'Operation failed.' });
    } finally {
      setBusy(false);
      setPending(null);
    }
  }

  async function handleExport() {
    setBusy(true);
    setMessage(null);
    try {
      const data = await exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'trip-planner-backup.json';
      a.click();
      URL.revokeObjectURL(url);
      setMessage({ ok: true, text: `Exported ${data.places.length} places · ${data.trips.length} trips.` });
    } catch (err) {
      setMessage({ ok: false, text: err.message || 'Export failed.' });
    } finally {
      setBusy(false);
    }
  }

  async function handleImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await importAll(data);
      onRefresh();
      const ps = data.places.length;
      const ts = (data.trips || []).length;
      setMessage({ ok: true, text: `Restored ${ps} place${ps !== 1 ? 's' : ''} · ${ts} trip${ts !== 1 ? 's' : ''}.` });
    } catch (err) {
      setMessage({ ok: false, text: err.message || 'Import failed — check the file.' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleMerge() {
    const src = sourceCityMerge;
    const tgt = targetCityMerge;
    setMergePending(false);
    await run(async () => {
      await mergeCities(src, tgt);
      const places = await getAllPlaces();
      const citySet = new Set(places.map((p) => p.city).filter(Boolean));
      setCities([...citySet].sort());
      setSourceCityMerge('');
      setTargetCityMerge('');
    });
  }

  // Render helper for destructive rows.
  function renderDestructive(action, label, fn) {
    if (pending !== action) {
      return (
        <button
          className="admin-btn admin-btn--danger"
          onClick={() => { setMessage(null); setPending(action); }}
          disabled={busy}
        >
          {label}
        </button>
      );
    }
    return (
      <span className="admin-confirm-row">
        <span className="admin-confirm-label">REALLY?</span>
        <button className="admin-btn admin-btn--confirm" onClick={() => run(fn)} disabled={busy}>
          CONFIRM
        </button>
        <button className="admin-btn" onClick={() => setPending(null)} disabled={busy}>
          CANCEL
        </button>
      </span>
    );
  }

  const mergeReady = sourceCityMerge && targetCityMerge && sourceCityMerge !== targetCityMerge;

  return (
    <div
      className="modal-backdrop modal-backdrop--center"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdropClick}
    >
      <div className="modal-panel admin-panel" role="dialog" aria-modal="true" aria-label="Admin">

        <div className="modal-header">
          <span className="modal-title admin-title">⚙ ADMIN</span>
          <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        </div>

        <div className="admin-body">

          {message && (
            <div className={`admin-msg ${message.ok ? 'admin-msg--ok' : 'admin-msg--err'}`} role="status">
              {message.ok ? '✓' : '⚠'} {message.text}
            </div>
          )}

          {/* ── Backup ── */}
          <div className="admin-section">
            <div className="admin-section-label">Backup</div>

            <div className="admin-row">
              <span className="admin-row-desc">Download all data as JSON</span>
              <button className="admin-btn" onClick={handleExport} disabled={busy}>
                ▾ EXPORT JSON
              </button>
            </div>

            <div className="admin-row">
              <span className="admin-row-desc">Restore from a backup file</span>
              <label className="admin-btn" style={{ cursor: busy ? 'not-allowed' : 'pointer', opacity: busy ? .4 : 1 }}>
                ▴ IMPORT JSON
                <input
                  ref={fileRef}
                  type="file"
                  accept=".json"
                  className="sr-only"
                  onChange={handleImport}
                  disabled={busy}
                />
              </label>
            </div>
          </div>

          <div className="admin-divider" />

          {/* ── City merge ── */}
          <div className="admin-section">
            <div className="admin-section-label">City Merge</div>

            <div className="admin-merge-fields">
              <select
                className="admin-merge-select"
                value={sourceCityMerge}
                onChange={(e) => { setSourceCityMerge(e.target.value); setMergePending(false); }}
                disabled={busy}
                aria-label="Source city"
              >
                <option value="">source city…</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <span className="admin-merge-arrow">→</span>
              <select
                className="admin-merge-select"
                value={targetCityMerge}
                onChange={(e) => { setTargetCityMerge(e.target.value); setMergePending(false); }}
                disabled={busy}
                aria-label="Target city"
              >
                <option value="">target city…</option>
                {cities.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="admin-row admin-row--merge">
              <span className="admin-row-desc">Rename all places in source city to target</span>
              {mergePending ? (
                <span className="admin-confirm-row">
                  <span className="admin-confirm-label">REALLY?</span>
                  <button className="admin-btn admin-btn--confirm" onClick={handleMerge} disabled={busy || !mergeReady}>
                    CONFIRM
                  </button>
                  <button className="admin-btn" onClick={() => setMergePending(false)} disabled={busy}>
                    CANCEL
                  </button>
                </span>
              ) : (
                <button
                  className="admin-btn"
                  onClick={() => { setMessage(null); setMergePending(true); }}
                  disabled={busy || !mergeReady}
                >
                  MERGE
                </button>
              )}
            </div>
          </div>

          <div className="admin-divider" />

          {/* ── Danger zone ── */}
          <div className="admin-section">
            <div className="admin-section-label">Danger Zone</div>

            <div className="admin-row">
              <span className="admin-row-desc">Remove all places from library</span>
              {renderDestructive('clearPlaces', 'CLEAR PLACES', clearAllPlaces)}
            </div>

            <div className="admin-row">
              <span className="admin-row-desc">Remove all trips and schedule items</span>
              {renderDestructive('clearTrips', 'CLEAR TRIPS', clearAllTrips)}
            </div>

            <div className="admin-row">
              <span className="admin-row-desc">Wipe everything — all tables</span>
              {renderDestructive('clearAll', 'CLEAR ALL DATA', clearAllData)}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
