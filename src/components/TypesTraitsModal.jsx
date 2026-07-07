import { useMemo, useRef, useState } from 'react';
import { putPlaceType, putVenueTrait, deletePlaceType, deleteVenueTrait } from '../db/repo.js';
import { useSettings } from '../context/SettingsContext.jsx';
import './TypesTraitsModal.css';

function toKey(label) {
  return label.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '_');
}

// Generates a unique key from a label, appending _2, _3, ... on collision.
function uniqueKey(label, existingKeys) {
  const base = toKey(label) || 'item';
  let key = base;
  let n = 2;
  while (existingKeys.has(key)) { key = `${base}_${n}`; n++; }
  return key;
}

export default function TypesTraitsModal({ places, onClose, onRefresh }) {
  const { placeTypes, venueTraits, reload } = useSettings();
  const [activeTab, setActiveTab] = useState('types'); // 'types' | 'traits'
  const [editing,      setEditing]      = useState(null); // the item being edited, or null
  const [editEmoji,    setEditEmoji]    = useState('');
  const [editLabel,    setEditLabel]    = useState('');
  const [editKeywords, setEditKeywords] = useState('');
  const [adding,       setAdding]       = useState(false);
  const [addEmoji,     setAddEmoji]     = useState('');
  const [addLabel,     setAddLabel]     = useState('');
  const [addKeywords,  setAddKeywords]  = useState('');
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState('');

  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);

  const list = activeTab === 'types' ? placeTypes : venueTraits;

  // Place count per key — p.type for types, p.tags membership for traits.
  const counts = useMemo(() => {
    const m = {};
    if (activeTab === 'types') {
      for (const p of places) m[p.type] = (m[p.type] || 0) + 1;
    } else {
      for (const p of places) {
        for (const tag of p.tags || []) m[tag] = (m[tag] || 0) + 1;
      }
    }
    return m;
  }, [places, activeTab]);

  function switchTab(tab) {
    setActiveTab(tab);
    setEditing(null);
    setAdding(false);
    setError('');
  }

  function startEdit(item) {
    setEditing(item);
    setAdding(false);
    setError('');
    setEditEmoji(item.emoji || '');
    setEditLabel(item.label || '');
    setEditKeywords((activeTab === 'types' ? item.keywords : item.hintKeywords || []).join(', '));
  }

  function startAdd() {
    setAdding(true);
    setEditing(null);
    setError('');
    setAddEmoji('');
    setAddLabel('');
    setAddKeywords('');
  }

  async function handleSave() {
    setBusy(true);
    setError('');
    try {
      const keywords = editKeywords.split(',').map(s => s.trim()).filter(Boolean);
      if (activeTab === 'types') {
        await putPlaceType({ ...editing, label: editLabel.trim(), emoji: editEmoji.trim(), keywords });
      } else {
        await putVenueTrait({ ...editing, label: editLabel.trim(), emoji: editEmoji.trim(), hintKeywords: keywords });
      }
      await reload();
      setEditing(null);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(key) {
    setBusy(true);
    setError('');
    try {
      if (activeTab === 'types') await deletePlaceType(key);
      else await deleteVenueTrait(key);
      await reload();
      setEditing(null);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Delete failed.');
    } finally {
      setBusy(false);
    }
  }

  async function handleAdd() {
    if (!addLabel.trim()) return;
    setBusy(true);
    setError('');
    try {
      const key = uniqueKey(addLabel, new Set(list.map(i => i.key)));
      const keywords = addKeywords.split(',').map(s => s.trim()).filter(Boolean);
      const base = { key, label: addLabel.trim(), emoji: addEmoji.trim() || '📍', order: list.length };
      if (activeTab === 'types') await putPlaceType({ ...base, keywords });
      else await putVenueTrait({ ...base, hintKeywords: keywords });
      await reload();
      setAdding(false);
      onRefresh();
    } catch (err) {
      setError(err.message || 'Add failed.');
    } finally {
      setBusy(false);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current && !busy) onClose();
  }

  const keywordsFieldLabel = activeTab === 'types' ? 'KEYWORDS' : 'HINT KEYWORDS';
  const keywordsFieldHint  = activeTab === 'types'
    ? 'trigger type auto-detection when typed in name field'
    : 'trigger trait suggestion in blob preview';

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdropClick}
    >
      <div className="modal-panel ttm-panel" role="dialog" aria-modal="true" aria-label="Types and traits">
        <div className="modal-header">
          <span className="modal-title">◈ TYPES & TRAITS</span>
          <button className="modal-close" onClick={onClose} disabled={busy} aria-label="Close">✕</button>
        </div>

        <div className="ttm-tabs">
          <button
            className={`ttm-tab${activeTab === 'types' ? ' ttm-tab--active' : ''}`}
            onClick={() => switchTab('types')}
          >PLACE TYPES</button>
          <button
            className={`ttm-tab${activeTab === 'traits' ? ' ttm-tab--active' : ''}`}
            onClick={() => switchTab('traits')}
          >TRAITS</button>
        </div>

        {error && <div className="ttm-error" role="alert">{error}</div>}

        <div className="ttm-list">
          <div className="ttm-add-row">
            {!adding ? (
              <button className="ttm-add-btn" onClick={startAdd} disabled={busy}>
                + ADD {activeTab === 'types' ? 'TYPE' : 'TRAIT'}
              </button>
            ) : (
              <div className="ttm-add-panel">
                <div className="ttm-edit-row">
                  <label>EMOJI</label>
                  <input className="ttm-emoji-input" value={addEmoji}
                    onChange={e => setAddEmoji(e.target.value)} maxLength={2} disabled={busy} />
                </div>
                <div className="ttm-edit-row">
                  <label>LABEL</label>
                  <input className="ttm-label-input" value={addLabel}
                    onChange={e => setAddLabel(e.target.value)} disabled={busy} autoFocus />
                </div>
                <div className="ttm-edit-row">
                  <label>{keywordsFieldLabel}</label>
                  <input className="ttm-keywords-input"
                    value={addKeywords}
                    onChange={e => setAddKeywords(e.target.value)}
                    placeholder="comma-separated, e.g. beer shop, bottle store"
                    disabled={busy} />
                  <span className="ttm-keywords-hint">{keywordsFieldHint}</span>
                </div>
                <div className="ttm-edit-actions">
                  <button className="ttm-btn ttm-btn--save" onClick={handleAdd} disabled={busy || !addLabel.trim()}>ADD</button>
                  <button className="ttm-btn" onClick={() => setAdding(false)} disabled={busy}>CANCEL</button>
                </div>
              </div>
            )}
          </div>

          {list.map(item => {
            const placeCount = counts[item.key] || 0;
            const isEditing  = editing?.key === item.key;
            return (
              <div key={item.key}>
                <div className="ttm-row">
                  <span className="ttm-emoji">{item.emoji}</span>
                  <span className="ttm-label">{item.label}</span>
                  <span className="ttm-key">{item.key}</span>
                  <span className="ttm-count">{placeCount}</span>
                  <button
                    className="ttm-edit-btn"
                    onClick={() => (isEditing ? setEditing(null) : startEdit(item))}
                    disabled={busy}
                  >{isEditing ? 'CLOSE' : 'EDIT'}</button>
                </div>

                {isEditing && (
                  <div className="ttm-edit-panel">
                    <div className="ttm-edit-row">
                      <label>EMOJI</label>
                      <input className="ttm-emoji-input" value={editEmoji}
                        onChange={e => setEditEmoji(e.target.value)} maxLength={2} disabled={busy} />
                    </div>
                    <div className="ttm-edit-row">
                      <label>LABEL</label>
                      <input className="ttm-label-input" value={editLabel}
                        onChange={e => setEditLabel(e.target.value)} disabled={busy} />
                    </div>
                    <div className="ttm-edit-row">
                      <label>KEY</label>
                      <span className="ttm-key-display">{item.key}</span>
                      <span className="ttm-key-note">(permanent)</span>
                    </div>
                    <div className="ttm-edit-row">
                      <label>{keywordsFieldLabel}</label>
                      <input className="ttm-keywords-input"
                        value={editKeywords}
                        onChange={e => setEditKeywords(e.target.value)}
                        placeholder="comma-separated, e.g. beer shop, bottle store"
                        disabled={busy} />
                      <span className="ttm-keywords-hint">{keywordsFieldHint}</span>
                    </div>
                    <div className="ttm-edit-actions">
                      <button className="ttm-btn ttm-btn--save" onClick={handleSave} disabled={busy}>SAVE</button>
                      <button className="ttm-btn" onClick={() => setEditing(null)} disabled={busy}>CANCEL</button>
                      {placeCount === 0 && (
                        <button className="ttm-btn ttm-btn--danger" onClick={() => handleDelete(item.key)} disabled={busy}>
                          DELETE
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
