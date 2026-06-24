import { useEffect, useRef, useState } from 'react';
import { addPlace, putPlace, getAllPlaces, mergePlaces as doMergePlaces, countScheduleItemsByPlace } from '../db/repo.js';
import { PLACE_TYPES, STATUSES, WEEKDAYS, typeMeta } from '../db/constants.js';
import { parseMapsUrl } from '../utils/mapsParser.js';
import { parseGoogleHours } from '../utils/hoursParser.js';
import { parseAddress, deriveFields } from '../utils/addressParser.js';
import { parseBlob } from '../utils/blobParser.js';
import BlobPreview from './BlobPreview.jsx';
import './PlaceForm.css';

const SCHEDULING_TAGS = ['breakfast', 'specialty-coffee', 'brunch', 'lunch', 'dinner', 'late-night'];

// Ordered — first match wins. More-specific phrases come before shorter ones.
const TYPE_KEYWORDS = [
  ['bottle_shop',   ['beer shop', 'bottle shop', 'beer store', 'beerstore']],
  ['brewery',       ['brewery', 'browar', 'brauerei', 'pivovar']],
  ['brewpub',       ['brewpub', 'brew pub', 'beer & food', 'beer and food', 'brewing']],
  ['taproom',       ['taproom', 'tap room', 'beer bar', 'craft beer', 'beer']],
  ['restaurant',    ['restaurant', 'bistro', 'brasserie', 'ristorante']],
  ['cafe',          ['café', 'cafe', 'coffee', 'kawiarnia', 'kaffee']],
  ['bar',           ['bar']],
  ['museum',        ['museum', 'muzeum', 'muzej', 'gallery', 'galeria', 'galeri']],
  ['park',          ['park', 'cemetery', 'cmentarz', 'hřbitov', 'garden', 'jardín', 'zoo', 'botanical']],
  ['accommodation', ['hotel', 'hostel', 'noclegi', 'apartment', 'apartament', 'pension', 'inn']],
];

function detectType(name) {
  const lower = name.toLowerCase();
  for (const [typeKey, keywords] of TYPE_KEYWORDS) {
    if (keywords.some((kw) => lower.includes(kw))) return typeKey;
  }
  return null;
}


function buildHoursState(openingHours) {
  const src = openingHours || {};
  return Object.fromEntries(
    WEEKDAYS.map((w) => [w.key, src[w.key] !== undefined ? src[w.key] : null])
  );
}

function parseTags(str) {
  return str.split(',').map((t) => t.trim()).filter(Boolean);
}

export default function PlaceForm({ initialData, onSave, onClose }) {
  const isEdit = Boolean(initialData);

  const [name,         setName]         = useState(initialData?.name         || '');
  const [type,         setType]         = useState(initialData?.type         || 'other');
  const [status,       setStatus]       = useState(initialData?.status       || 'wishlist');
  const [city,         setCity]         = useState(initialData?.city         || '');
  const [country,      setCountry]      = useState(initialData?.country      || '');
  const [address,      setAddress]      = useState(initialData?.address      || '');
  const [lat,          setLat]          = useState(initialData?.lat          ?? '');
  const [lng,          setLng]          = useState(initialData?.lng          ?? '');
  const [googleMapsUrl, setGoogleMapsUrl] = useState(initialData?.googleMapsUrl || '');
  const [untappdUrl,   setUntappdUrl]   = useState(initialData?.untappdUrl   || '');
  const [websiteUrl,   setWebsiteUrl]   = useState(initialData?.websiteUrl   || '');
  const [rating,       setRating]       = useState(initialData?.rating       ?? '');
  const [tags,         setTags]         = useState((initialData?.tags || []).join(', '));
  const [notes,        setNotes]        = useState(initialData?.notes        || '');
  const [hours,        setHours]        = useState(() => buildHoursState(initialData?.openingHours));
  const [suggestedType, setSuggestedType] = useState(null);
  const [busy,         setBusy]         = useState(false);
  const [error,        setError]        = useState('');
  const [prefillUrl,   setPrefillUrl]   = useState('');
  const [prefillMsg,   setPrefillMsg]   = useState(null); // { ok, text } | null
  const [addrPaste,    setAddrPaste]    = useState('');
  const [addrMsg,      setAddrMsg]      = useState(null); // { ok, text } | null
  const [addrSegments, setAddrSegments] = useState([]);   // [{ id, raw, role }]
  const [hoursPaste,   setHoursPaste]   = useState('');
  const [hoursMsg,     setHoursMsg]     = useState(null); // { ok, text } | null
  const [blobText,     setBlobText]     = useState('');
  const [blobResult,   setBlobResult]   = useState(null); // parseBlob output | null
  const [blobApplied,  setBlobApplied]  = useState(false);

  // ── Merge section state (edit mode only) ────────────────────────────────
  const [otherPlaces,    setOtherPlaces]    = useState([]);
  const [mergeSearch,    setMergeSearch]    = useState('');
  const [mergeShowAll,   setMergeShowAll]   = useState(false);
  const [mergeCandidate, setMergeCandidate] = useState(null);
  const [mergeSlotCount, setMergeSlotCount] = useState(0);
  const [mergeBusy,      setMergeBusy]      = useState(false);
  const [mergeMsg,       setMergeMsg]       = useState(null);

  const firstRef        = useRef(null);
  const backdropRef     = useRef(null);
  const mouseDownTarget = useRef(null);
  const handleSubmitRef = useRef(null);

  // Keep ref current so the keydown handler always calls the latest handleSubmit.
  handleSubmitRef.current = handleSubmit;

  // Focus first field on open; ESC to close; Enter to save (not in textareas).
  useEffect(() => {
    firstRef.current?.focus();
    function onKey(e) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Enter' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault();
        handleSubmitRef.current(e);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Live-apply city/country/address whenever segment roles change.
  useEffect(() => {
    if (!addrSegments.length) return;
    const { city: c, country: co, address: a } = deriveFields(addrSegments);
    setCity(c);
    setCountry(co);
    setAddress(a);
  }, [addrSegments]);

  // Load all other places for the merge search (edit mode only).
  useEffect(() => {
    if (!isEdit) return;
    getAllPlaces().then((ps) => setOtherPlaces(ps.filter((p) => p.id !== initialData.id)));
  }, [isEdit, initialData?.id]);

  // Count schedule items for the selected duplicate to show in the merge preview.
  useEffect(() => {
    if (!mergeCandidate) { setMergeSlotCount(0); return; }
    countScheduleItemsByPlace(mergeCandidate.id).then(setMergeSlotCount);
  }, [mergeCandidate]);

  function handlePrefill(url) {
    const parsed = parseMapsUrl(url);

    if (parsed.short) {
      setPrefillMsg({ ok: false, text: 'Short link detected. Open it in your browser, then copy the URL from the address bar.' });
      return;
    }

    const filled = [];
    if (parsed.name)                           { setName(parsed.name);         filled.push('name'); }
    if (parsed.lat != null && parsed.lng != null) {
      setLat(String(parsed.lat));
      setLng(String(parsed.lng));
      filled.push('coordinates');
    }
    setGoogleMapsUrl(url);

    setPrefillMsg(
      filled.length > 0
        ? { ok: true,  text: `Prefilled: ${filled.join(' · ')} · maps URL` }
        : { ok: false, text: 'URL stored — name and coordinates not found in this link.' }
    );
  }

  function handlePrefillPaste(e) {
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    e.preventDefault();
    setPrefillUrl(text);
    handlePrefill(text);
  }

  function handleBlobParse(text) {
    const src = text ?? blobText;
    if (!src.trim()) return;
    setBlobResult(parseBlob(src));
    setBlobApplied(false);
  }

  function handleBlobPaste(e) {
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    e.preventDefault();
    setBlobText(text);
    handleBlobParse(text);
  }

  const ADDR_ROLE_CYCLE = { city: 'country', country: 'street', street: 'postcode', postcode: 'ignore', ignore: 'city' };

  function cycleSegmentRole(id) {
    setAddrSegments(segs => segs.map(s => s.id === id ? { ...s, role: ADDR_ROLE_CYCLE[s.role] } : s));
  }

  function cycleSegmentRoleInBlob(id) {
    setBlobResult(prev => {
      if (!prev?.extracted?.addrSegments) return prev;
      const segs = prev.extracted.addrSegments.map(s =>
        s.id === id ? { ...s, role: ADDR_ROLE_CYCLE[s.role] } : s
      );
      return { ...prev, extracted: { ...prev.extracted, addrSegments: segs, addrDerived: deriveFields(segs) } };
    });
  }

  function applyBlob() {
    if (!blobResult) return;
    const { extracted } = blobResult;

    if (extracted.name)         setName(extracted.name);
    if (extracted.url)          setGoogleMapsUrl(extracted.url);
    if (extracted.lat != null)  setLat(String(extracted.lat));
    if (extracted.lng != null)  setLng(String(extracted.lng));
    if (extracted.openingHours) setHours(h => ({ ...h, ...extracted.openingHours }));
    if (extracted.untappdUrl)   setUntappdUrl(extracted.untappdUrl);
    if (extracted.websiteUrl)   setWebsiteUrl(extracted.websiteUrl);
    // facebookUrl → no place field; social links are shown in preview only
    // addrSegments → existing useEffect live-applies city/country/address
    if (extracted.addrSegments?.length) setAddrSegments(extracted.addrSegments);

    setBlobApplied(true);
    setBlobResult(null);
    setBlobText('');
  }

  function handleAddrParse(text) {
    const src = text ?? addrPaste;
    if (!src.trim()) { setAddrMsg({ ok: false, text: 'Nothing to parse.' }); return; }
    const { segments } = parseAddress(src);
    if (!segments.length) { setAddrMsg({ ok: false, text: 'Could not split — check the address format.' }); return; }
    setAddrSegments(segments);
    setAddrMsg({ ok: true, text: `${segments.length} segment${segments.length !== 1 ? 's' : ''} — tap chip to relabel.` });
  }

  function handleAddrPaste(e) {
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    e.preventDefault();
    setAddrPaste(text);
    handleAddrParse(text);
  }

  function handleHoursParse(text) {
    const parsed = parseGoogleHours(text || hoursPaste);
    const count  = Object.keys(parsed).length;
    if (!count) { setHoursMsg({ ok: false, text: '0 days parsed — check the format.' }); return; }
    setHours(h => ({ ...h, ...parsed }));
    setHoursMsg({ ok: true, text: `Parsed ${count} day${count !== 1 ? 's' : ''}.` });
    const det = detectType(name);
    if (det && det !== type) setSuggestedType(det);
  }

  function handleHoursPaste(e) {
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    e.preventDefault();
    setHoursPaste(text);
    handleHoursParse(text);
  }

  // Merge search: filter by city (unless showAll), then by name substring.
  const mergeFiltered = otherPlaces.filter((p) => {
    if (!mergeShowAll && initialData?.city && p.city !== initialData.city) return false;
    const q = mergeSearch.trim().toLowerCase();
    if (q && !p.name.toLowerCase().includes(q)) return false;
    return true;
  }).slice(0, 8);

  async function handleMerge() {
    if (!mergeCandidate) return;
    setMergeBusy(true);
    setMergeMsg(null);
    try {
      await doMergePlaces(initialData.id, mergeCandidate.id);
      onSave();
    } catch (err) {
      setMergeMsg({ ok: false, text: 'Merge failed — check the console.' });
      console.error(err);
      setMergeBusy(false);
    }
  }

  function toggleSchedulingTag(tag) {
    const current = parseTags(tags);
    if (current.includes(tag)) {
      setTags(current.filter((t) => t !== tag).join(', '));
    } else {
      setTags([...current, tag].join(', '));
    }
  }

  function setDayOpen(key, open) {
    setHours((h) => ({
      ...h,
      [key]: open ? { open: '10:00', close: '22:00' } : null,
    }));
  }

  function setDayTime(key, field, value) {
    setHours((h) => ({
      ...h,
      [key]: { ...(h[key] || { open: '', close: '' }), [field]: value },
    }));
  }

  async function handleSubmit(e) {
    e?.preventDefault();
    if (!name.trim()) { setError('Name is required.'); return; }
    setBusy(true);
    setError('');

    const data = {
      name:          name.trim(),
      type,
      status,
      city:          city.trim(),
      country:       country.trim(),
      address:       address.trim(),
      lat:           lat !== '' ? parseFloat(lat) : null,
      lng:           lng !== '' ? parseFloat(lng) : null,
      googleMapsUrl: googleMapsUrl.trim(),
      untappdUrl:    untappdUrl.trim(),
      websiteUrl:    websiteUrl.trim(),
      rating:        rating !== '' ? parseFloat(rating) : null,
      tags:          parseTags(tags),
      notes:         notes.trim(),
      openingHours:  hours,
    };

    try {
      if (isEdit) {
        await putPlace({ ...initialData, ...data });
      } else {
        await addPlace(data);
      }
      onSave();
    } catch (err) {
      setError('Save failed — check the console.');
      console.error(err);
      setBusy(false);
    }
  }

  function handleBackdropClick(e) {
    if (e.target === backdropRef.current &&
        mouseDownTarget.current === backdropRef.current) onClose();
  }

  function handleUrlFieldPaste(e) {
    const text = e.clipboardData?.getData('text/plain') || '';
    if (!text) return;
    const parsed = parseMapsUrl(text);
    if (parsed.short) return;
    if (!name.trim() && parsed.name) setName(parsed.name);
    if (parsed.lat != null && parsed.lng != null) {
      setLat(String(parsed.lat));
      setLng(String(parsed.lng));
    }
  }

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onMouseDown={e => { mouseDownTarget.current = e.target; }}
      onClick={handleBackdropClick}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-label={isEdit ? 'Edit place' : 'Add place'}
      >
        <div className="modal-header">
          <span className="modal-title">{isEdit ? '◈ EDIT PLACE' : '◈ NEW PLACE'}</span>
          <button className="modal-close" onClick={onClose} aria-label="Close form">✕</button>
        </div>

        <form className="place-form" onSubmit={handleSubmit} noValidate>
          {error && <div className="form-error" role="alert">{error}</div>}

          {/* ---- Quick paste ---- */}
          <div className="form-section blob-section">
            <span className="prefill-label">QUICK PASTE</span>
            <p className="blob-hint">
              Paste a Google Maps place block — name, URL, hours, address at once.
            </p>
            <div className="prefill-row">
              <textarea
                className="blob-textarea"
                rows={5}
                value={blobText}
                onChange={e => setBlobText(e.target.value)}
                onPaste={handleBlobPaste}
                placeholder={"Craftownia\ncraft beer bar · Zabłocie 9, Kraków\nMonday: Closed\n...\nhttps://maps.google.com/..."}
              />
            </div>
            <div className="prefill-row">
              <button type="button" className="prefill-btn" onClick={() => handleBlobParse()}>
                PARSE
              </button>
            </div>

            {blobResult && (
              <div className="blob-preview">
                <BlobPreview result={blobResult} onCycleRole={cycleSegmentRoleInBlob} />
                <div className="blob-actions">
                  <button type="button" className="blob-btn-apply" onClick={applyBlob}>
                    ◈ APPLY TO FORM
                  </button>
                  <button
                    type="button"
                    className="blob-btn-cancel"
                    onClick={() => { setBlobResult(null); setBlobText(''); }}
                  >
                    ✕ DISCARD
                  </button>
                </div>
              </div>
            )}

            {blobApplied && (
              <span className="blob-applied">✓ applied — review fields below</span>
            )}
          </div>

          {/* ---- Prefill strip (add mode only) ---- */}
          {!isEdit && (
            <div className="prefill-strip">
              <span className="prefill-label">PREFILL FROM MAPS LINK</span>
              <div className="prefill-row">
                <input
                  className="prefill-input"
                  type="url"
                  value={prefillUrl}
                  onChange={(e) => setPrefillUrl(e.target.value)}
                  onPaste={handlePrefillPaste}
                  placeholder="Paste a Google Maps URL…"
                  aria-label="Google Maps URL for prefill"
                />
                <button
                  type="button"
                  className="prefill-btn"
                  onClick={() => handlePrefill(prefillUrl)}
                >
                  PARSE
                </button>
              </div>
              {prefillMsg && (
                <span className={`prefill-msg ${prefillMsg.ok ? 'prefill-msg--ok' : 'prefill-msg--warn'}`}>
                  {prefillMsg.ok ? '✓' : '⚠'} {prefillMsg.text}
                </span>
              )}
            </div>
          )}

          {/* ---- Identity ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">IDENTITY</legend>

            <label className="form-row">
              <span className="form-label">NAME *</span>
              <input
                ref={firstRef}
                className="form-input"
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  const det = detectType(e.target.value);
                  if (det && det !== type) setSuggestedType(det);
                  else setSuggestedType(null);
                }}
                placeholder="e.g. Świat Piwa"
                required
              />
            </label>

            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">TYPE</span>
                <select className="form-select" value={type} onChange={(e) => { setType(e.target.value); setSuggestedType(null); }}>
                  {PLACE_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.emoji} {t.label}</option>
                  ))}
                </select>
                {suggestedType && suggestedType !== type && (() => {
                  const meta = PLACE_TYPES.find((t) => t.key === suggestedType);
                  return meta ? (
                    <div className="type-suggest">
                      <span>Detected: {meta.emoji} {meta.label.toUpperCase()}</span>
                      <button type="button" className="type-suggest-btn" onClick={() => { setType(suggestedType); setSuggestedType(null); }}>APPLY</button>
                      <button type="button" className="type-suggest-dismiss" onClick={() => setSuggestedType(null)}>✕</button>
                    </div>
                  ) : null;
                })()}
              </label>

              <label className="form-row">
                <span className="form-label">STATUS</span>
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>{s.emoji} {s.label}</option>
                  ))}
                </select>
              </label>

              <label className="form-row">
                <span className="form-label">RATING (0–5)</span>
                <input
                  className="form-input"
                  type="number"
                  min="0" max="5" step="0.5"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  placeholder="—"
                />
              </label>
            </div>
          </fieldset>

          {/* ---- Location ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">LOCATION</legend>

            <div className="prefill-strip">
              <span className="prefill-label">PARSE ADDRESS</span>
              <div className="prefill-row">
                <input
                  className="prefill-input"
                  type="text"
                  value={addrPaste}
                  onChange={(e) => setAddrPaste(e.target.value)}
                  onPaste={handleAddrPaste}
                  placeholder="paste address line from Google Maps"
                  aria-label="Address string for parsing"
                />
                <button type="button" className="prefill-btn" onClick={() => handleAddrParse()}>PARSE</button>
              </div>
              {addrMsg && (
                <span className={`prefill-msg ${addrMsg.ok ? 'prefill-msg--ok' : 'prefill-msg--warn'}`}>
                  {addrMsg.ok ? '✓' : '⚠'} {addrMsg.text}
                </span>
              )}
              {addrSegments.length > 0 && (
                <div className="addr-chips">
                  {addrSegments.map(seg => (
                    <button
                      key={seg.id}
                      type="button"
                      className={`addr-chip addr-chip--${seg.role}`}
                      onClick={() => cycleSegmentRole(seg.id)}
                      title="Tap to cycle role"
                    >
                      <span className="addr-chip-text">{seg.raw}</span>
                      <span className="addr-chip-role">{seg.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">CITY</span>
                <input className="form-input" type="text"
                  value={city} onChange={(e) => setCity(e.target.value)}
                  placeholder="Kraków" />
              </label>
              <label className="form-row">
                <span className="form-label">COUNTRY</span>
                <input className="form-input" type="text"
                  value={country} onChange={(e) => setCountry(e.target.value)}
                  placeholder="PL" />
              </label>
            </div>

            <label className="form-row">
              <span className="form-label">ADDRESS</span>
              <input className="form-input" type="text"
                value={address} onChange={(e) => setAddress(e.target.value)}
                placeholder="Street address" />
            </label>

            <div className="form-cols">
              <label className="form-row">
                <span className="form-label">LAT</span>
                <input className="form-input" type="number" step="any"
                  value={lat} onChange={(e) => setLat(e.target.value)}
                  placeholder="50.057" />
              </label>
              <label className="form-row">
                <span className="form-label">LNG</span>
                <input className="form-input" type="number" step="any"
                  value={lng} onChange={(e) => setLng(e.target.value)}
                  placeholder="19.939" />
              </label>
            </div>

            <label className="form-row">
              <span className="form-label">GOOGLE MAPS URL</span>
              <input className="form-input" type="url"
                value={googleMapsUrl} onChange={(e) => setGoogleMapsUrl(e.target.value)}
                onPaste={handleUrlFieldPaste}
                placeholder="https://maps.google.com/…" />
              {isEdit && (
                <span className="form-hint">paste a Maps URL here to update name + coordinates</span>
              )}
            </label>
          </fieldset>

          {/* ---- Links ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">LINKS</legend>
            <label className="form-row">
              <span className="form-label">WEBSITE URL</span>
              <input className="form-input" type="url"
                value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
                placeholder="https://…" />
            </label>
            <label className="form-row">
              <span className="form-label">UNTAPPD URL</span>
              <input className="form-input" type="url"
                value={untappdUrl} onChange={(e) => setUntappdUrl(e.target.value)}
                placeholder="https://untappd.com/v/…" />
            </label>
          </fieldset>

          {/* ---- Notes & Tags ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">NOTES & TAGS</legend>
            <div className="sched-hints">
              <span className="sched-hints-label">SCHEDULING HINTS</span>
              <div className="sched-chips">
                {SCHEDULING_TAGS.map((tag) => {
                  const active = parseTags(tags).includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      className={`sched-chip${active ? ' sched-chip--on' : ''}`}
                      onClick={() => toggleSchedulingTag(tag)}
                    >
                      {tag}
                    </button>
                  );
                })}
              </div>
            </div>
            <label className="form-row">
              <span className="form-label">TAGS (comma-separated)</span>
              <input className="form-input" type="text"
                value={tags} onChange={(e) => setTags(e.target.value)}
                placeholder="craft, must-visit, outdoor" />
            </label>
            <label className="form-row">
              <span className="form-label">NOTES</span>
              <textarea className="form-input form-textarea"
                value={notes} onChange={(e) => setNotes(e.target.value)}
                placeholder="Anything worth knowing…"
                rows={3} />
            </label>
          </fieldset>

          {/* ---- Opening Hours ---- */}
          <fieldset className="form-section">
            <legend className="form-legend">OPENING HOURS</legend>

            <div className="prefill-strip">
              <span className="prefill-label">PASTE GOOGLE HOURS</span>
              <div className="prefill-row">
                <textarea
                  className="prefill-input prefill-textarea"
                  value={hoursPaste}
                  onChange={(e) => setHoursPaste(e.target.value)}
                  onPaste={handleHoursPaste}
                  placeholder={"Monday\n12 PM–12 AM\nTuesday\nClosed"}
                  rows={3}
                  aria-label="Google Maps hours text for prefill"
                />
                <button type="button" className="prefill-btn" onClick={() => handleHoursParse()}>PARSE</button>
              </div>
              {hoursMsg && (
                <span className={`prefill-msg ${hoursMsg.ok ? 'prefill-msg--ok' : 'prefill-msg--warn'}`}>
                  {hoursMsg.ok ? '✓' : '⚠'} {hoursMsg.text}
                </span>
              )}
            </div>

            <div className="hours-editor">
              {WEEKDAYS.map((w) => {
                const h      = hours[w.key];
                const isOpen = h !== null && h !== undefined;
                return (
                  <div key={w.key} className="hours-row">
                    <span className="hours-day-lbl">{w.label.toUpperCase()}</span>

                    <label className="hours-toggle" title={isOpen ? 'Click to mark closed' : 'Click to mark open'}>
                      <input
                        type="checkbox"
                        checked={isOpen}
                        onChange={(e) => setDayOpen(w.key, e.target.checked)}
                        className="sr-only"
                      />
                      <span className={`hours-badge ${isOpen ? 'hours-badge--open' : 'hours-badge--closed'}`}>
                        {isOpen ? 'OPEN' : 'CLOSED'}
                      </span>
                    </label>

                    {isOpen && (
                      <div className="hours-times">
                        <input
                          className="form-input form-input--time"
                          type="time"
                          value={h?.open || ''}
                          onChange={(e) => setDayTime(w.key, 'open', e.target.value)}
                          aria-label={`${w.label} opening time`}
                        />
                        <span className="hours-dash">–</span>
                        <input
                          className="form-input form-input--time"
                          type="time"
                          value={h?.close || ''}
                          onChange={(e) => setDayTime(w.key, 'close', e.target.value)}
                          aria-label={`${w.label} closing time`}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            {type === 'accommodation' && (
              <p className="form-hours-hint">e.g. reception hours or check-in window</p>
            )}
          </fieldset>

          {/* ---- Merge / Deduplicate (edit mode only) ---- */}
          {isEdit && (
            <fieldset className="form-section merge-section">
              <legend className="form-legend">⚠ MERGE / DEDUPLICATE</legend>

              <div className="merge-search-row">
                <input
                  className="form-input"
                  type="search"
                  placeholder="Search for duplicate…"
                  value={mergeSearch}
                  onChange={(e) => { setMergeSearch(e.target.value); setMergeCandidate(null); setMergeMsg(null); }}
                />
              </div>

              <label className="merge-showall">
                <input
                  type="checkbox"
                  checked={mergeShowAll}
                  onChange={(e) => { setMergeShowAll(e.target.checked); setMergeCandidate(null); }}
                />
                <span>Show all cities</span>
              </label>

              {/* Results list — shown when no candidate is selected */}
              {!mergeCandidate && (
                <div className="merge-list">
                  {mergeFiltered.length === 0 ? (
                    <p className="merge-empty">
                      {mergeSearch.trim()
                        ? 'No matches.'
                        : (!mergeShowAll && initialData?.city)
                          ? `No other places in ${initialData.city}.`
                          : 'No other places in library.'}
                    </p>
                  ) : (
                    mergeFiltered.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        className="merge-row"
                        onClick={() => { setMergeCandidate(p); setMergeMsg(null); }}
                      >
                        <span className="merge-row-icon">{typeMeta(p.type).emoji}</span>
                        <span className="merge-row-name">{p.name}</span>
                        <span className="merge-row-city">{p.city || '—'}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Preview panel — shown once a candidate is selected */}
              {mergeCandidate && (
                <div className="merge-preview">
                  <div className="merge-cols">
                    <div className="merge-col">
                      <div className="merge-col-label">PRIMARY · THIS PLACE</div>
                      <div className="merge-field">{typeMeta(initialData.type).emoji} {initialData.name}</div>
                      <div className="merge-field merge-field--dim">{initialData.city || '—'}</div>
                      <div className="merge-field merge-field--dim">{initialData.status}</div>
                      <div className="merge-field merge-field--dim">
                        {Object.keys(initialData.openingHours || {}).length} days known
                      </div>
                      {initialData.notes && (
                        <div className="merge-field merge-field--notes">{initialData.notes}</div>
                      )}
                    </div>
                    <div className="merge-arrow">→</div>
                    <div className="merge-col">
                      <div className="merge-col-label">DUPLICATE</div>
                      <div className="merge-field">{typeMeta(mergeCandidate.type).emoji} {mergeCandidate.name}</div>
                      <div className="merge-field merge-field--dim">{mergeCandidate.city || '—'}</div>
                      <div className="merge-field merge-field--dim">{mergeCandidate.status}</div>
                      <div className="merge-field merge-field--dim">
                        {Object.keys(mergeCandidate.openingHours || {}).length} days known
                      </div>
                      {mergeCandidate.notes && (
                        <div className="merge-field merge-field--notes">{mergeCandidate.notes}</div>
                      )}
                    </div>
                  </div>

                  <p className="merge-summary">
                    After merge: <strong>{initialData.name}</strong> absorbs <strong>{mergeCandidate.name}</strong>.
                    {mergeSlotCount > 0 && (
                      <> {mergeSlotCount} schedule slot{mergeSlotCount !== 1 ? 's' : ''} will be reassigned.</>
                    )}
                  </p>

                  {initialData.address && mergeCandidate.address &&
                   initialData.address !== mergeCandidate.address && (
                    <p className="merge-warning">
                      ⚠ Different addresses — are these really the same venue?
                    </p>
                  )}

                  {mergeMsg && (
                    <p className={`merge-msg${mergeMsg.ok ? ' merge-msg--ok' : ' merge-msg--warn'}`}>
                      {mergeMsg.text}
                    </p>
                  )}

                  <div className="merge-actions">
                    <button
                      type="button"
                      className="merge-btn-confirm"
                      onClick={handleMerge}
                      disabled={mergeBusy}
                    >
                      {mergeBusy ? 'MERGING…' : 'MERGE'}
                    </button>
                    <button
                      type="button"
                      className="merge-btn-cancel"
                      onClick={() => { setMergeCandidate(null); setMergeMsg(null); }}
                    >
                      CANCEL
                    </button>
                  </div>
                </div>
              )}
            </fieldset>
          )}

          {/* ---- Actions ---- */}
          <div className="form-actions">
            <button type="submit" className="btn-submit" disabled={busy}>
              {busy ? 'SAVING…' : isEdit ? '◈ SAVE CHANGES' : '◈ ADD TO LIBRARY'}
            </button>
            <button type="button" className="btn-cancel" onClick={onClose} disabled={busy}>
              CANCEL
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
