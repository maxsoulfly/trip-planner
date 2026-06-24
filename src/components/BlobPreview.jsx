// Preview panel for the QUICK PASTE blob — shows classified lines on the left
// and extracted values on the right. Address chips are relabellable via onCycleRole.

// Human-readable labels for the left-column role chips.
const ROLE_DISPLAY = {
  'name':          'name',
  'hours':         'hours',
  'address':       'address',
  'url-maps':      'maps',
  'url-untappd':   'untappd',
  'url-website':   'website',
  'url-facebook':  'social',
  'url-instagram': 'social',
};

// CSS suffix for colour; social/facebook/instagram share 'social'.
function roleCss(role) {
  if (role === 'url-facebook' || role === 'url-instagram') return 'social';
  if (role.startsWith('url-')) return 'url';
  return role;
}

export default function BlobPreview({ result, onCycleRole }) {
  const { lines, extracted } = result;
  const { name, url, lat, lng, shortUrl, openingHours,
          addrSegments, untappdUrl, websiteUrl, facebookUrl } = extracted;

  const hoursDayCount = openingHours ? Object.keys(openingHours).length : 0;

  return (
    <div className="blob-preview-grid">
      {/* ── Left: classified lines ── */}
      <div className="blob-lines-col">
        <div className="blob-col-label">LINES</div>
        {lines.map((line, i) => (
          <div key={i} className="blob-line-chip">
            <span className={`blob-line-role blob-line-role--${roleCss(line.role)}`}>
              {ROLE_DISPLAY[line.role] ?? line.role}
            </span>
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
            <span className="blob-ext-label">MAPS URL</span>
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

        {websiteUrl && (
          <div className="blob-ext-row">
            <span className="blob-ext-label">WEBSITE</span>
            <span className="blob-ext-value">{websiteUrl.length > 40 ? websiteUrl.slice(0, 40) + '…' : websiteUrl}</span>
          </div>
        )}

        {untappdUrl && (
          <div className="blob-ext-row">
            <span className="blob-ext-label">UNTAPPD</span>
            <span className="blob-ext-value">{untappdUrl.length > 40 ? untappdUrl.slice(0, 40) + '…' : untappdUrl}</span>
          </div>
        )}

        {facebookUrl && (
          <div className="blob-ext-row">
            <span className="blob-ext-label">SOCIAL</span>
            <span className="blob-ext-value" style={{ color: 'var(--dim)', opacity: .6 }}>seen · not applied</span>
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

        {!name && !url && hoursDayCount === 0 && !addrSegments?.length
         && !websiteUrl && !untappdUrl && (
          <span className="blob-ext-value" style={{ color: 'var(--dim)', opacity: .6 }}>
            Nothing extracted
          </span>
        )}
      </div>
    </div>
  );
}
