import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { parseTripXlsx } from '../utils/importTripXlsx.js';
import { addPlace, addScheduleItem, getAllPlaces, deleteScheduleItemsByTrip } from '../db/repo.js';
import './TripXlsxImport.css';

export default function TripXlsxImport({ trip, onDone, onClose }) {
  const [step,    setStep]    = useState('upload');   // 'upload' | 'preview'
  const [parsed,  setParsed]  = useState(null);        // { toSchedule, stubPlaces, warnings }
  const [busy,    setBusy]    = useState(false);
  const [result,  setResult]  = useState(null);        // { added, stubs }
  const [error,   setError]   = useState('');

  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    try {
      const buffer   = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const allPlaces = await getAllPlaces();
      const data = parseTripXlsx(workbook, trip, allPlaces);
      setParsed(data);
      setStep('preview');
    } catch (err) {
      setError(`Could not read file: ${err.message}`);
      console.error(err);
    }
  }

  async function handleConfirm() {
    if (!parsed) return;
    setBusy(true);
    setError('');
    try {
      // 1. Create stub places and build name → id map
      const stubIdMap = {};
      for (const stub of parsed.stubPlaces) {
        const place = await addPlace(stub);
        stubIdMap[stub.name.trim().toLowerCase()] = place.id;
      }

      // 2. Replace existing schedule
      await deleteScheduleItemsByTrip(trip.id);

      // 3. Insert new schedule items
      let added = 0;
      for (const item of parsed.toSchedule) {
        const placeId = item.placeId || stubIdMap[item.stubName];
        if (!placeId) continue;
        await addScheduleItem({
          tripId:  trip.id,
          placeId,
          date:    item.date,
          block:   item.block,
          order:   item.order,
          kind:    'place',
        });
        added++;
      }

      setResult({ added, stubs: parsed.stubPlaces.length });
    } catch (err) {
      setError('Import failed — check the console.');
      console.error(err);
      setBusy(false);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current && !busy) onClose();
  }

  const matchedCount = parsed
    ? parsed.toSchedule.filter((s) => s.placeId).length
    : 0;
  const stubCount = parsed ? parsed.stubPlaces.length : 0;
  const totalItems = parsed ? parsed.toSchedule.length : 0;

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdropClick}
    >
      <div className="modal-panel txi-panel" role="dialog" aria-modal="true" aria-label="Import trip schedule">

        <div className="modal-header">
          <span className="modal-title">
            {step === 'upload' ? '◈ IMPORT SCHEDULE — UPLOAD' : '◈ IMPORT SCHEDULE — PREVIEW'}
          </span>
          <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        </div>

        <div className="txi-body">
          {error && <div className="txi-error" role="alert">{error}</div>}

          {/* Upload step */}
          {step === 'upload' && (
            <div className="txi-upload">
              <p className="txi-hint">
                Select an <code>.xlsx</code> schedule previously exported from this trip.
                Places already in the library will be matched by name.
                Unrecognised names become new library stubs.
              </p>
              <label className="txi-file-label">
                <input
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFile}
                  className="sr-only"
                />
                <span className="txi-file-btn">SELECT XLSX FILE</span>
              </label>
            </div>
          )}

          {/* Preview + confirm */}
          {step === 'preview' && parsed && !result && (
            <>
              <div className="txi-summary">
                <div className="txi-summary-row">
                  <span className="txi-summary-label">SCHEDULE ITEMS</span>
                  <span className="txi-summary-val">{totalItems}</span>
                </div>
                <div className="txi-summary-row">
                  <span className="txi-summary-label">MATCHED IN LIBRARY</span>
                  <span className="txi-summary-val txi-summary-val--ok">{matchedCount}</span>
                </div>
                {stubCount > 0 && (
                  <div className="txi-summary-row">
                    <span className="txi-summary-label">NEW STUBS</span>
                    <span className="txi-summary-val txi-summary-val--warn">{stubCount}</span>
                  </div>
                )}
              </div>

              {parsed.warnings.length > 0 && (
                <div className="txi-warnings">
                  <div className="txi-warn-label">⚠ UNMATCHED PLACES</div>
                  {parsed.warnings.map((w, i) => (
                    <div key={i} className="txi-warn-item">{w}</div>
                  ))}
                </div>
              )}

              <p className="txi-replace-warn">
                This will replace all currently scheduled items for this trip.
              </p>

              <div className="txi-actions">
                <button
                  className="txi-btn-primary"
                  onClick={handleConfirm}
                  disabled={busy || totalItems === 0}
                >
                  {busy ? 'IMPORTING…' : `◈ REPLACE SCHEDULE (${totalItems} ITEMS)`}
                </button>
                <button className="txi-btn-ghost" onClick={() => setStep('upload')} disabled={busy}>
                  BACK
                </button>
              </div>
            </>
          )}

          {/* Done */}
          {result && (
            <>
              <div className="txi-result">
                <div className="txi-result-line txi-result-line--ok">✓ {result.added} items added to schedule</div>
                {result.stubs > 0 && (
                  <div className="txi-result-line txi-result-line--warn">{result.stubs} new place stubs created</div>
                )}
              </div>
              <div className="txi-actions">
                <button className="txi-btn-primary" onClick={onDone}>DONE</button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
