export function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—'
  if (bytes < 1024)              return bytes + ' B'
  if (bytes < 1024 * 1024)       return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB'
}

export function formatDuration(sec) {
  if (!sec) return null
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

export function formatSpeed(bps) {
  if (!bps || bps === 0) return ''
  if (bps < 1024 * 1024) return (bps / 1024).toFixed(0) + ' KB/s'
  return (bps / (1024 * 1024)).toFixed(1) + ' MB/s'
}

export function formatEta(sec) {
  if (!sec || sec <= 0) return ''
  if (sec < 60)   return `${Math.round(sec)}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${Math.round(sec % 60)}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

export function formatTime(ts) {
  if (!ts) return '—'
  return new Date(ts * 1000).toLocaleString()
}

export function platformColor(platform) {
  const map = {
    youtube: '#ff0000',
    twitter: '#1da1f2',
    x: '#000000',
    vimeo: '#1ab7ea',
    twitch: '#9146ff',
    tiktok: '#010101',
    instagram: '#e1306c',
    facebook: '#1877f2',
    reddit: '#ff4500',
    soundcloud: '#ff5500',
    dailymotion: '#0066dc',
    linkedin: '#0a66c2',
  }
  const key = (platform || '').toLowerCase()
  return map[key] || '#6c757d'
}

export function speedLabelKey(bps) {
  if (!bps || bps === 0) return null
  if (bps < 1024 * 1024) return { key: 'speed_kb', val: (bps / 1024).toFixed(0) }
  return { key: 'speed_mb', val: (bps / (1024 * 1024)).toFixed(1) }
}
