// Preview panel for the QUICK PASTE blob — shows classified lines on the left
// and extracted values on the right. Address chips are relabellable via onCycleRole.

export default function BlobPreview({ result, onCycleRole }) {
  const { lines, extracted } = result;
  const { name, url, lat, lng, shortUrl, openingHours, addrSegments } = extracted;

  const hoursDayCount = openingHours ? Object.keys(openingHours).length : 0;

  return (
    <div className="blob-preview-grid">
      {/* ── Left: classified lines ── */}
      <div className="blob-lines-col">
        <div className="blob-col-label">LINES</div>
        {lines.map((line, i) => (
          <div key={i} className="blob-line-chip">
            <span className={`blob-line-role blob-line-role--${line.role}`}>{line.role}</span>
            <span className="blob-line-text" title={line.raw}>{line.raw}</span>
          </div>
        ))}
      </div>

      {/* ── Right: extracted summary ── */}
      <div className="blob-extracted-col">
        <div className="blob-col-label">EXTRACTED</div>

        {name && (
          <div className="blob-ext-row">
            <span className="blob-ext-label">NAME</span>
            <span className="blob-ext-value blob-ext-value--amber">{name}</span>
          </div>
        )}

        {shortUrl && (
          <div className="blob-ext-row">
            <span className="blob-ext-value blob-ext-value--warn">⚠ Short URL — open in browser first</span>
          </div>
        )}

        {!shortUrl && url && (
          <div className="blob-ext-row">
            <span className="blob-ext-label">URL</span>
            <span className="blob-ext-value">{url.length > 40 ? url.slice(0, 40) + '…' : url}</span>
          </div>
        )}

        {lat != null && lng != null && (
          <div className="blob-ext-row">
            <span className="blob-ext-label">COORDS</span>
            <span className="blob-ext-value">{lat} / {lng}</span>
          </div>
        )}

        {hoursDayCount > 0 && (
          <div className="blob-ext-row">
            <span className="blob-ext-label">HOURS</span>
            <span className="blob-ext-value">{hoursDayCount} day{hoursDayCount !== 1 ? 's' : ''} parsed</span>
          </div>
        )}

        {addrSegments?.length > 0 && (
          <div className="blob-ext-row">
            <span className="blob-ext-label">ADDRESS</span>
            <div className="addr-chips" style={{ marginTop: '3px' }}>
              {addrSegments.map(seg => (
                <button
                  key={seg.id}
                  type="button"
                  className={`addr-chip addr-chip--${seg.role}`}
                  onClick={() => onCycleRole(seg.id)}
                  title="Tap to cycle role"
                >
                  <span className="addr-chip-text">{seg.raw}</span>
                  <span className="addr-chip-role">{seg.role}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {!name && !url && hoursDayCount === 0 && !addrSegments?.length && (
          <span className="blob-ext-value" style={{ color: 'var(--dim)', opacity: .6 }}>
            Nothing extracted
          </span>
        )}
      </div>
    </div>
  );
}
