import { useRef, useState } from 'react';
import { addPlace } from '../db/repo.js';
import './BulkPaste.css';

function normaliseName(s) {
  return s.toLowerCase()
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// "merge" action means: user confirms this pasted name refers to an existing
// place — no data is written to that place. Creating a duplicate is prevented.
// If they want to update the existing record, they use the normal edit flow.

export default function BulkPaste({ existingPlaces, cityFilter, onImport, onClose }) {
  const [pasteText, setPasteText] = useState('');
  const [rows,      setRows]      = useState([]);
  const [busy,      setBusy]      = useState(false);
  const [bulkCity,  setBulkCity]  = useState(cityFilter || '');

  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);

  const candidates = bulkCity.trim()
    ? existingPlaces.filter(p => p.city === bulkCity.trim())
    : existingPlaces;

  function handleParse() {
    const lines = pasteText.split('\n').map(l => l.trim()).filter(Boolean);
    setRows(lines.map(raw => {
      const n     = normaliseName(raw);
      const exact = candidates.find(p => normaliseName(p.name) === n);
      if (exact) return { raw, normalised: n, status: 'exists', candidate: exact, action: 'skip' };
      const likely = candidates.find(p => {
        const pn = normaliseName(p.name);
        return (pn.includes(n) || n.includes(pn)) && Math.min(n.length, pn.length) >= 4;
      });
      if (likely) return { raw, normalised: n, status: 'likely', candidate: likely, action: 'merge' };
      return { raw, normalised: n, status: 'new', candidate: null, action: 'create' };
    }));
  }

  function setAction(i, action) {
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, action } : r));
  }

  async function handleImport() {
    setBusy(true);
    const toCreate = rows.filter(r => r.action === 'create');
    const toMerge  = rows.filter(r => r.action === 'merge' && r.candidate);

    for (const r of toCreate) {
      await addPlace({
        name:   r.raw,
        type:   'other',
        status: 'wishlist',
        city:   bulkCity.trim(),
      });
    }

    setBusy(false);
    onImport({ created: toCreate.length, merged: toMerge.length });
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current) onClose();
  }

  const lineCount = pasteText.split('\n').filter(l => l.trim()).length;

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdropClick}
    >
      <div className="modal-panel bp-panel" role="dialog" aria-modal="true" aria-label="Bulk paste places">
        <div className="modal-header">
          <span className="modal-title">◈ BULK PASTE</span>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {rows.length === 0 && (
          <div className="bp-paste-area">
            <div className="bp-city-row">
              <label className="bp-city-label">CITY</label>
              <input
                className="bp-city-input"
                type="text"
                value={bulkCity}
                onChange={e => setBulkCity(e.target.value)}
                placeholder="Sofia, Kraków, …"
              />
            </div>
            <textarea
              className="bp-textarea"
              rows={10}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              placeholder={"Craftownia\nStrefa Piwa\nOmerta\n..."}
              autoFocus
            />
            {!bulkCity.trim() && lineCount > 0 && (
              <p className="bp-city-note">Enter a city first</p>
            )}
            <button
              className="bp-btn-parse"
              onClick={handleParse}
              disabled={lineCount === 0 || !bulkCity.trim()}
            >
              PARSE {lineCount} LINE{lineCount !== 1 ? 'S' : ''}
            </button>
          </div>
        )}

        {rows.length > 0 && (
          <>
            <div className="bp-summary">
              {rows.filter(r => r.status === 'new').length} new ·{' '}
              {rows.filter(r => r.status === 'likely').length} likely match ·{' '}
              {rows.filter(r => r.status === 'exists').length} already exist
            </div>
            <div className="bp-rows">
              {rows.map((row, i) => (
                <div key={i} className={`bp-row bp-row--${row.status}`}>
                  <span className="bp-row-name">{row.raw}</span>
                  {row.status === 'likely' && (
                    <span className="bp-row-match">
                      ≈ {row.candidate.name}{row.candidate.city ? ` · ${row.candidate.city}` : ''}
                    </span>
                  )}
                  {row.status === 'exists' && (
                    <span className="bp-row-match">
                      = {row.candidate.name}{row.candidate.city ? ` · ${row.candidate.city}` : ''}
                    </span>
                  )}
                  <div className="bp-row-actions">
                    {row.status === 'new' && (
                      <span className="bp-badge bp-badge--new">CREATE</span>
                    )}
                    {row.status === 'likely' && (
                      <>
                        <button
                          className={`bp-action-btn${row.action === 'merge'  ? ' bp-action-btn--on' : ''}`}
                          onClick={() => setAction(i, 'merge')}
                        >MERGE</button>
                        <button
                          className={`bp-action-btn${row.action === 'create' ? ' bp-action-btn--on' : ''}`}
                          onClick={() => setAction(i, 'create')}
                        >CREATE NEW</button>
                      </>
                    )}
                    {row.status === 'exists' && (
                      <button
                        className={`bp-action-btn${row.action === 'skip' ? ' bp-action-btn--on' : ''}`}
                        onClick={() => setAction(i, row.action === 'skip' ? 'create' : 'skip')}
                      >
                        {row.action === 'skip' ? 'SKIP' : 'CREATE ANYWAY'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="bp-footer">
              <button
                className="bp-btn-import"
                onClick={handleImport}
                disabled={busy || rows.filter(r => r.action === 'create').length === 0}
              >
                {busy
                  ? 'IMPORTING…'
                  : `◈ IMPORT ${rows.filter(r => r.action === 'create').length} PLACES`}
              </button>
              <button className="bp-btn-back" onClick={() => setRows([])}>← BACK</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
