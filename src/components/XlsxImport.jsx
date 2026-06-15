import { useState } from 'react';
import * as XLSX from 'xlsx';
import { parseXlsxWorkbook } from '../utils/xlsxImport.js';
import { getAllPlaces, addPlace } from '../db/repo.js';
import './XlsxImport.css';

export default function XlsxImport({ onDone, onClose }) {
  const [step,      setStep]      = useState('upload'); // 'upload' | 'preview'
  const [parsed,    setParsed]    = useState(null);     // { places, warnings }
  const [importing, setImporting] = useState(false);
  const [result,    setResult]    = useState(null);     // { imported, skipped }
  const [error,     setError]     = useState('');

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const buffer   = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const data     = parseXlsxWorkbook(workbook);
      setParsed(data);
      setStep('preview');
    } catch (err) {
      setError(`Could not read file: ${err.message}`);
      console.error(err);
    }
  }

  async function handleImport() {
    if (!parsed) return;
    setImporting(true);
    setError('');
    try {
      const existing  = await getAllPlaces();
      const existingSet = new Set(
        existing.map((p) => `${(p.name || '').toLowerCase()}|${(p.city || '').toLowerCase()}`)
      );

      let imported = 0;
      let skipped  = 0;
      for (const place of parsed.places) {
        const key = `${place.name.toLowerCase()}|${place.city.toLowerCase()}`;
        if (existingSet.has(key)) { skipped++; continue; }
        await addPlace(place);
        imported++;
      }
      setResult({ imported, skipped });
    } catch (err) {
      setError('Import failed — check the console.');
      console.error(err);
      setImporting(false);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget && !importing) onClose();
  }

  // City breakdown for the preview
  const cityTotals = parsed
    ? Object.entries(
        parsed.places.reduce((acc, p) => {
          acc[p.city] = (acc[p.city] || 0) + 1;
          return acc;
        }, {})
      ).sort((a, b) => b[1] - a[1])
    : [];

  return (
    <div className="xi-backdrop" onClick={handleBackdropClick}>
      <div className="xi-panel" role="dialog" aria-modal="true" aria-label="XLSX import">

        <div className="xi-header">
          <span className="xi-title">
            {step === 'upload' ? '◈ XLSX IMPORT — UPLOAD' : '◈ XLSX IMPORT — PREVIEW'}
          </span>
          <button className="xi-close" onClick={onClose} disabled={importing} aria-label="Close">✕</button>
        </div>

        <div className="xi-body">
          {error && <div className="xi-error" role="alert">{error}</div>}

          {/* ── Step 1: Upload ── */}
          {step === 'upload' && (
            <div className="xi-upload">
              <p className="xi-hint">
                Select <code>Travel_Plans_Yana.xlsx</code> to seed the place library.
                Existing places (matched by name + city) will be skipped.
              </p>
              <label className="xi-file-label">
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFile}
                  className="sr-only"
                />
                <span className="xi-file-btn">SELECT XLSX FILE</span>
              </label>
            </div>
          )}

          {/* ── Step 2: Preview + confirm ── */}
          {step === 'preview' && parsed && !result && (
            <>
              <div className="xi-totals">
                <span className="xi-total-count">{parsed.places.length} places found</span>
                <span className="xi-total-sep"> · </span>
                <span className="xi-total-cities">{cityTotals.length} cities</span>
              </div>

              <div className="xi-city-list">
                {cityTotals.map(([city, count]) => (
                  <div key={city} className="xi-city-row">
                    <span className="xi-city-name">{city.toUpperCase()}</span>
                    <span className="xi-city-count">{count}</span>
                  </div>
                ))}
              </div>

              {parsed.warnings.length > 0 && (
                <div className="xi-warnings">
                  <div className="xi-warn-label">⚠ WARNINGS</div>
                  {parsed.warnings.map((w, i) => (
                    <div key={i} className="xi-warn-item">{w}</div>
                  ))}
                </div>
              )}

              <p className="xi-hours-note">
                Opening hours imported where available (day-specific from the sheet).
                Other days remain unknown — edit per-place if needed.
              </p>

              <div className="xi-actions">
                <button
                  className="xi-btn-primary"
                  onClick={handleImport}
                  disabled={importing || parsed.places.length === 0}
                >
                  {importing ? 'IMPORTING…' : `◈ IMPORT ${parsed.places.length} PLACES`}
                </button>
                <button className="xi-btn-ghost" onClick={() => setStep('upload')} disabled={importing}>
                  BACK
                </button>
              </div>
            </>
          )}

          {/* ── Done ── */}
          {result && (
            <>
              <div className="xi-result">
                <div className="xi-result-imported">✓ {result.imported} imported</div>
                {result.skipped > 0 && (
                  <div className="xi-result-skipped">{result.skipped} skipped (already exist)</div>
                )}
              </div>
              <div className="xi-actions">
                <button className="xi-btn-primary" onClick={onDone}>DONE</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
