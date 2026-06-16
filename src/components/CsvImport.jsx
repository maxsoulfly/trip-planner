import { useMemo, useRef, useState } from 'react';
import Papa from 'papaparse';
import { addPlace } from '../db/repo.js';
import { PLACE_TYPES, STATUSES } from '../db/constants.js';
import './CsvImport.css';

// Place fields available for column mapping (openingHours excluded by design —
// absent key = unknown per the data contract; add hours per-place after import).
const IMPORT_FIELDS = [
  { key: 'name',          label: 'NAME',          required: true  },
  { key: 'type',          label: 'TYPE',          required: false },
  { key: 'city',          label: 'CITY',          required: false },
  { key: 'country',       label: 'COUNTRY',       required: false },
  { key: 'address',       label: 'ADDRESS',       required: false },
  { key: 'googleMapsUrl', label: 'MAPS URL',      required: false },
  { key: 'untappdUrl',    label: 'UNTAPPD URL',   required: false },
  { key: 'status',        label: 'STATUS',        required: false },
  { key: 'rating',        label: 'RATING',        required: false },
  { key: 'notes',         label: 'NOTES',         required: false },
  { key: 'tags',          label: 'TAGS',          required: false },
];

// For each Place field, which CSV header substrings (after normalization) suggest a match.
const FIELD_HINTS = {
  name:          ['name', 'place', 'venue', 'location', 'title'],
  type:          ['type', 'category', 'kind'],
  city:          ['city', 'town'],
  country:       ['country'],
  address:       ['address', 'addr', 'street'],
  googleMapsUrl: ['google_maps_url', 'maps_url', 'google_maps', 'maps', 'url', 'link'],
  untappdUrl:    ['untappd_url', 'untappd'],
  status:        ['status'],
  rating:        ['rating', 'score', 'stars'],
  notes:         ['notes', 'note', 'description', 'comment', 'comments'],
  tags:          ['tags', 'tag', 'labels'],
};

const PLACE_TYPE_KEYS = new Set(PLACE_TYPES.map((t) => t.key));
const STATUS_KEYS     = new Set(STATUSES.map((s) => s.key));

// Normalize a CSV header for matching: lowercase, collapse whitespace/hyphens to underscore.
function norm(s) {
  return s.toLowerCase().trim().replace(/[\s\-]+/g, '_');
}

function autoDetectMapping(headers) {
  const normed  = headers.map(norm);
  const mapping = {};

  for (const field of IMPORT_FIELDS) {
    const hints = FIELD_HINTS[field.key] || [];
    let matched = '';
    for (const hint of hints) {
      const idx = normed.indexOf(hint);
      if (idx !== -1) { matched = headers[idx]; break; }
    }
    mapping[field.key] = matched;
  }

  return mapping;
}

// Convert one CSV row to a Place-shaped object using the current mapping.
// openingHours is intentionally left as {} (unknown) per the data contract.
function rowToPlace(row, mapping) {
  function val(field) {
    const col = mapping[field];
    return col ? String(row[col] ?? '').trim() : '';
  }

  const typeRaw   = val('type');
  const typeNorm  = typeRaw.toLowerCase().replace(/[\s\-]+/g, '_');
  const typeKey   = PLACE_TYPE_KEYS.has(typeNorm)
    ? typeNorm
    : (PLACE_TYPES.find((t) => t.label.toLowerCase() === typeRaw.toLowerCase())?.key || 'other');

  const statusRaw = val('status');
  const statusKey = STATUS_KEYS.has(statusRaw.toLowerCase())
    ? statusRaw.toLowerCase()
    : (STATUSES.find((s) => s.label.toLowerCase() === statusRaw.toLowerCase())?.key || 'wishlist');

  const ratingRaw = val('rating');
  const rating    = ratingRaw ? parseFloat(ratingRaw) : NaN;

  return {
    name:          val('name'),
    type:          typeKey,
    city:          val('city'),
    country:       val('country'),
    address:       val('address'),
    googleMapsUrl: val('googleMapsUrl'),
    untappdUrl:    val('untappdUrl'),
    status:        statusKey,
    rating:        !isNaN(rating) ? rating : null,
    notes:         val('notes'),
    tags:          val('tags').split(',').map((t) => t.trim()).filter(Boolean),
    openingHours:  {},
  };
}

export default function CsvImport({ onDone, onClose }) {
  const [step,      setStep]      = useState('upload'); // 'upload' | 'map' | 'preview'
  const [rawRows,   setRawRows]   = useState([]);
  const [headers,   setHeaders]   = useState([]);
  const [mapping,   setMapping]   = useState({});
  const [importing, setImporting] = useState(false);
  const [error,     setError]     = useState('');

  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete(result) {
        const hdrs = result.meta.fields || [];
        if (!result.data.length || !hdrs.length) {
          setError('CSV is empty or has no headers.');
          return;
        }
        setHeaders(hdrs);
        setRawRows(result.data);
        setMapping(autoDetectMapping(hdrs));
        setStep('map');
      },
      error(err) {
        setError(`Could not parse file: ${err.message}`);
      },
    });
  }

  // Derive all mapped rows — only recomputed when rawRows or mapping changes.
  const mappedRows = useMemo(
    () => rawRows.map((row) => rowToPlace(row, mapping)),
    [rawRows, mapping]
  );
  const validRows = useMemo(() => mappedRows.filter((r) => r.name), [mappedRows]);
  const skipped   = mappedRows.length - validRows.length;

  async function handleImport() {
    setImporting(true);
    setError('');
    try {
      for (const place of validRows) {
        await addPlace(place);
      }
      onDone();
    } catch (err) {
      setError('Import failed — check the console.');
      console.error(err);
      setImporting(false);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current) onClose();
  }

  const STEP_TITLE = {
    upload:  '◈ CSV IMPORT — UPLOAD',
    map:     '◈ CSV IMPORT — MAP COLUMNS',
    preview: '◈ CSV IMPORT — PREVIEW',
  };

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdropClick}
    >
      <div className="modal-panel ci-panel" role="dialog" aria-modal="true" aria-label="CSV import">

        <div className="modal-header">
          <span className="modal-title">{STEP_TITLE[step]}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close import">✕</button>
        </div>

        <div className="ci-body">
          {error && <div className="ci-error" role="alert">{error}</div>}

          {/* ── Step 1: Upload ───────────────────────────────────────── */}
          {step === 'upload' && (
            <div className="ci-upload">
              <p className="ci-hint">
                Select a <code>.csv</code> file with column headers in the first row.
                Opening hours are not imported from CSV — add them per-place after import.
              </p>
              <label className="ci-file-label">
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleFile}
                  className="sr-only"
                />
                <span className="ci-file-btn">SELECT CSV FILE</span>
              </label>
            </div>
          )}

          {/* ── Step 2: Map columns ──────────────────────────────────── */}
          {step === 'map' && (
            <>
              <p className="ci-hint">
                {rawRows.length} rows · {headers.length} columns detected.
                Map each place field to a CSV column, or leave as (skip).
              </p>

              <div className="ci-map-scroll">
                <table className="ci-map-table">
                  <thead>
                    <tr>
                      <th>PLACE FIELD</th>
                      <th>CSV COLUMN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {IMPORT_FIELDS.map((f) => (
                      <tr key={f.key}>
                        <td className="ci-field-label">
                          {f.label}
                          {f.required && <span className="ci-required"> *</span>}
                        </td>
                        <td>
                          <select
                            className="ci-map-select"
                            value={mapping[f.key] || ''}
                            onChange={(e) =>
                              setMapping((m) => ({ ...m, [f.key]: e.target.value }))
                            }
                          >
                            <option value="">(skip)</option>
                            {headers.map((h) => (
                              <option key={h} value={h}>{h}</option>
                            ))}
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="ci-hours-note">
                Opening hours are not imported — add them per-place after import.
              </p>

              <div className="ci-actions">
                <button className="ci-btn-primary" onClick={() => setStep('preview')}>
                  PREVIEW →
                </button>
                <button className="ci-btn-ghost" onClick={() => setStep('upload')}>
                  BACK
                </button>
              </div>
            </>
          )}

          {/* ── Step 3: Preview + confirm ────────────────────────────── */}
          {step === 'preview' && (
            <>
              <div className="ci-counts">
                <span className="ci-count-import">{validRows.length} will import</span>
                <span className="ci-count-sep"> · </span>
                <span className="ci-count-skip">{skipped} skipped (no name)</span>
              </div>

              {validRows.length > 0 ? (
                <div className="ci-preview-scroll">
                  <table className="ci-preview-table">
                    <thead>
                      <tr>
                        <th>NAME</th>
                        <th>TYPE</th>
                        <th>CITY</th>
                        <th>STATUS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {validRows.slice(0, 5).map((r, i) => (
                        <tr key={i}>
                          <td>{r.name}</td>
                          <td>{r.type}</td>
                          <td>{r.city || '—'}</td>
                          <td>{r.status}</td>
                        </tr>
                      ))}
                      {validRows.length > 5 && (
                        <tr className="ci-more-row">
                          <td colSpan={4}>+ {validRows.length - 5} more…</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="ci-hint">No rows have a name — nothing to import. Go back and check the mapping.</p>
              )}

              <div className="ci-actions">
                <button
                  className="ci-btn-primary"
                  onClick={handleImport}
                  disabled={importing || validRows.length === 0}
                >
                  {importing ? 'IMPORTING…' : `◈ IMPORT ${validRows.length} PLACES`}
                </button>
                <button className="ci-btn-ghost" onClick={() => setStep('map')} disabled={importing}>
                  BACK
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
