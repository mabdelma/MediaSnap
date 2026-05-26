import { formatSpeed, formatBytes, formatEta } from '../utils/format.js'

export default function ProgressBar({ percent = 0, speed = 0, eta = 0, downloaded = 0, total = 0, label = '' }) {
  const pct = Math.min(Math.max(percent, 0), 100)

  return (
    <div className="progress-section">
      <div className="progress-label">
        <span>{label || (pct < 100 ? 'Downloading…' : 'Complete ✓')}</span>
        <span>{pct.toFixed(1)}%</span>
      </div>
      <div className="progress-bar-bg">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {(speed > 0 || eta > 0 || total > 0) && (
        <div className="progress-stats">
          {speed > 0 && <span>⚡ {formatSpeed(speed)}</span>}
          {eta   > 0 && <span>⏳ {formatEta(eta)}</span>}
          {total > 0 && <span>📦 {formatBytes(downloaded)} / {formatBytes(total)}</span>}
        </div>
      )}
    </div>
  )
}
