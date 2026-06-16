import { useState } from 'react';
import { STATUSES, typeMeta } from '../db/constants.js';
import './PlaceList.css';

const STAMP_LABEL = {
  wishlist: '☆ FLAGGED',
  planned:  '◐ MARKED',
  visited:  '✓ SECURED',
};

export default function PlaceList({ places, onEdit, onBulkDelete }) {
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [confirming,  setConfirming]  = useState(false);

  const allSelected = places.length > 0 && places.every((p) => selectedIds.has(p.id));

  function toggleAll(checked) {
    setSelectedIds(checked ? new Set(places.map((p) => p.id)) : new Set());
    setConfirming(false);
  }

  function toggleOne(id, checked) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
    setConfirming(false);
  }

  function handleConfirmDelete() {
    onBulkDelete([...selectedIds]);
    setSelectedIds(new Set());
    setConfirming(false);
  }

  const selCount = selectedIds.size;

  return (
    <div className="pl-root" aria-label="Place list">

      {selCount > 0 && (
        <div className="pl-bulk-bar">
          {confirming ? (
            <>
              <span className="pl-confirm-label">REALLY? DELETE {selCount} PLACE{selCount !== 1 ? 'S' : ''}?</span>
              <button className="pl-btn pl-btn--confirm" onClick={handleConfirmDelete}>CONFIRM</button>
              <button className="pl-btn" onClick={() => setConfirming(false)}>CANCEL</button>
            </>
          ) : (
            <button className="pl-btn pl-btn--danger" onClick={() => setConfirming(true)}>
              DELETE SELECTED ({selCount})
            </button>
          )}
        </div>
      )}

      <div className="pl-table" role="grid">
        <div className="pl-row pl-row--header" role="row">
          <label className="pl-cell pl-cell--check" aria-label="Select all">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={(e) => toggleAll(e.target.checked)}
            />
          </label>
          <span className="pl-cell pl-cell--type">TYPE</span>
          <span className="pl-cell pl-cell--name">NAME</span>
          <span className="pl-cell pl-cell--city">CITY</span>
          <span className="pl-cell pl-cell--status">STATUS</span>
          <span className="pl-cell pl-cell--flag" aria-label="Incomplete flag" />
          <span className="pl-cell pl-cell--actions" />
        </div>

        {places.length === 0 && (
          <div className="pl-empty">No matches.</div>
        )}

        {places.map((p) => {
          const type  = typeMeta(p.type);
          const stamp = STAMP_LABEL[p.status] || '';
          const isSelected = selectedIds.has(p.id);
          return (
            <div
              key={p.id}
              className={`pl-row${isSelected ? ' pl-row--selected' : ''}`}
              role="row"
            >
              <label className="pl-cell pl-cell--check">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => toggleOne(p.id, e.target.checked)}
                  aria-label={`Select ${p.name}`}
                />
              </label>
              <span className="pl-cell pl-cell--type" title={type.label}>
                {type.emoji}
              </span>
              <button className="pl-cell pl-cell--name pl-name-btn" onClick={() => onEdit(p)}>
                {p.name}
              </button>
              <span className="pl-cell pl-cell--city">{p.city || '—'}</span>
              <span className="pl-cell pl-cell--status pl-stamp">{stamp}</span>
              <span className="pl-cell pl-cell--flag">
                {/* incomplete marker passed from App via the filtered places array */}
              </span>
              <div className="pl-cell pl-cell--actions">
                <button className="pl-action-btn" onClick={() => onEdit(p)} aria-label={`Edit ${p.name}`}>
                  EDIT
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
