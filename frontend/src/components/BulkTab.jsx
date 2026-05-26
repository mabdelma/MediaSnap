import { useState, useEffect, useRef, useCallback } from 'react'
import axios from 'axios'
import ProgressBar from './ProgressBar.jsx'
import { formatDuration } from '../utils/format.js'
import { useLang } from '../context/LangContext.jsx'

const AUDIO_FORMATS   = ['mp3', 'm4a', 'wav', 'ogg', 'flac']
const AUDIO_QUALITIES = [
  { value: '0',   label: 'Best (VBR)' },
  { value: '320', label: '320 kbps'   },
  { value: '192', label: '192 kbps'   },
  { value: '128', label: '128 kbps'   },
  { value: '64',  label: '64 kbps'    },
]

function fireNotification(title, body) {
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' })
  }
}

// ── Queue item SSE download ──────────────────────────────────────────────────
async function downloadItem(item, onProgress, onDone, onError) {
  try {
    const response = await fetch('/api/download', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        url:           item.url,
        format_id:     item.options.audioOnly ? 'bestaudio/best' : (item.options.formatId || 'bestvideo+bestaudio/best'),
        audio_only:    item.options.audioOnly  || false,
        audio_format:  item.options.audioFormat  || 'mp3',
        audio_quality: item.options.audioQuality || '0',
        subtitles:     item.options.subtitles    || false,
        title:         item.title,
        thumbnail_url: item.thumbnail,
        platform:      item.platform || 'unknown',
        quality_label: item.options.audioOnly ? 'Audio' : 'Video',
      }),
    })
    if (!response.ok) { const err = await response.json(); throw new Error(err.detail || 'Request failed') }

    const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n'); buffer = lines.pop()
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        try {
          const msg = JSON.parse(line.slice(6))
          if      (msg.event === 'progress') onProgress(item.id, msg)
          else if (msg.event === 'ready')    { onDone(item.id, msg); return }
          else if (msg.event === 'error')    { onError(item.id, msg.message); return }
        } catch (_) {}
      }
    }
  } catch (err) { onError(item.id, err.message) }
}

// ── Countdown helper ──────────────────────────────────────────────────────────
function useCountdown(targetMs) {
  const [remaining, setRemaining] = useState(0)
  useEffect(() => {
    if (!targetMs) return
    const tick = () => setRemaining(Math.max(0, targetMs - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [targetMs])
  if (!targetMs) return null
  const sec = Math.floor(remaining / 1000)
  if (sec <= 0) return null
  if (sec < 60)   return `${sec}s`
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
}

// Inline countdown label used inside the queue list
function ScheduledCountdown({ scheduledAt }) {
  const label = useCountdown(scheduledAt)
  if (!label) return <span className="text-muted" style={{ fontSize: '0.78rem' }}>⏳ Starting soon…</span>
  return <span className="text-muted" style={{ fontSize: '0.78rem' }}>⏰ Starts in {label}</span>
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function BulkTab({ settings, onHistoryChanged }) {
  const { t } = useLang()
  const [mode, setMode] = useState('bulk')

  // Bulk mode
  const [bulkText, setBulkText] = useState('')

  // Playlist mode
  const [playlistUrl,    setPlaylistUrl]    = useState('')
  const [playlistInfo,   setPlaylistInfo]   = useState(null)
  const [fetchingPL,     setFetchingPL]     = useState(false)
  const [plError,        setPlError]        = useState(null)
  const [selected,       setSelected]       = useState(new Set())
  // Per-playlist scheduling
  const [plScheduleMode, setPlScheduleMode] = useState(false)
  const [plScheduledAt,  setPlScheduledAt]  = useState('')

  // Shared options
  const [audioOnly,    setAudioOnly]     = useState(false)
  const [audioFormat,  setAudioFormat]  = useState(settings?.default_audio_format  || 'mp3')
  const [audioQuality, setAudioQuality] = useState(settings?.default_audio_quality || '0')

  // Schedule start for the entire queue (queue-level)
  const [scheduleMode, setScheduleMode] = useState(false)
  const [scheduledAt,  setScheduledAt]  = useState('')
  const scheduleTimerRef = useRef(null)

  // Queue
  const [queue,     setQueue]     = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const runningRef  = useRef(false)
  const maxConcurrent = settings?.max_concurrent || 2

  // ── Scheduled item auto-release timer ─────────────────────────────────────
  // Checks every second; flips 'scheduled' items to 'pending' when their time arrives.
  useEffect(() => {
    const id = setInterval(() => {
      const now = Date.now()
      setQueue(q => {
        const needsFlip = q.some(i => i.status === 'scheduled' && i.scheduledAt <= now)
        if (!needsFlip) return q
        return q.map(i =>
          i.status === 'scheduled' && i.scheduledAt <= now
            ? { ...i, status: 'pending' }
            : i
        )
      })
    }, 1000)
    return () => clearInterval(id)
  }, [])

  // ── Queue processing ────────────────────────────────────────────────────────
  const updateItem = useCallback((id, patch) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...patch } : item))
  }, [])

  const onProgress = useCallback((id, msg) => {
    updateItem(id, { status: 'downloading', progress: { percent: msg.percent, speed: msg.speed, eta: msg.eta, downloaded: msg.downloaded, total: msg.total } })
  }, [updateItem])

  const onDone = useCallback((id, msg) => {
    updateItem(id, { status: 'done', job_id: msg.file_id, filename: msg.filename, progress: null })
    onHistoryChanged?.()
    setQueue(q => {
      const item = q.find(i => i.id === id)
      if (item) fireNotification('MediaSnap', `"${item.title}" is ready!`)
      return q
    })
  }, [updateItem, onHistoryChanged])

  const onError = useCallback((id, message) => {
    updateItem(id, { status: 'error', errorMsg: message, progress: null })
  }, [updateItem])

  // Concurrency driver — only processes 'pending' items (not 'scheduled')
  useEffect(() => {
    if (!isRunning) return
    const pending     = queue.filter(i => i.status === 'pending')
    const activeCount = queue.filter(i => i.status === 'downloading').length
    const slots       = maxConcurrent - activeCount

    for (let i = 0; i < Math.min(slots, pending.length); i++) {
      const item = pending[i]
      updateItem(item.id, { status: 'downloading', progress: { percent: 0, speed: 0, eta: 0, downloaded: 0, total: 0 } })
      downloadItem(item, onProgress, onDone, onError)
    }

    const scheduled  = queue.filter(i => i.status === 'scheduled').length
    if (pending.length === 0 && activeCount === 0 && scheduled === 0 && queue.length > 0) {
      setIsRunning(false); runningRef.current = false
    }
  }, [queue, isRunning, maxConcurrent, onProgress, onDone, onError, updateItem])

  // ── Playlist fetch ─────────────────────────────────────────────────────────
  const fetchPlaylist = async () => {
    if (!playlistUrl.trim()) return
    setFetchingPL(true); setPlError(null); setPlaylistInfo(gnull); setSelected(new Set())
    try {
      const { data } = await axios.post('/api/playlist-info', { url: playlistUrl.trim() })
      setPlaylistInfo(data)
      setSelected(new Set(data.videos.map(v => v.id || v.url)))
    } catch (err) { setPlError(err.response?.data?.detail || 'Failed to fetch playlist.') }
    finally { setFetchingPL(false) }
  }

  const toggleSelect = (key) => setSelected(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  const selectAll    = () => setSelected(new Set(playlistInfo.videos.map(v => v.id || v.url)))
  const deselectAll  = () => setSelected(new Set())

  //  clearInterval(id)
  }, [])

  // ── Queue processing ───────────────────────────────────────────────────────
  const updateItem = useCallback((id, patch) => {
    setQueue(q => q.map(item => item.id === id ? { ...item, ...patch } : item))
  }, [])

  const onProgress = useCallback((id, msg) => {
    updateItem(id, { status: 'downloading', progress: { percent: msg.percent, speed: msg.speed, eta: msg.eta, downloaded: msg.downloaded, total: msg.total } })
  }, [updateItem])

  const onDone = useCallback((id, msg) => {
    updateItem(id, { status: 'done', job_id: msg.file_id, filename: msg.filename, progress: null })
    onHistoryChanged?.()
    setQueue(q => {
      const item = q.find(i => i.id === id)
      if (item) fireNotification('MediaSnap', `"${item.title}" is ready!`)
      return q
    })
  }, [updateItem, onHistoryChanged])

  const onError = useCallback((id, message) => {
    updateItem(id, { status: 'error', errorMsg: message, progress: null })
  }, [updateItem])

  // Concurrency driver — only processes 'pending' items (not 'scheduled')
  useEffect(() => {
    if (!isRunning) return
    const pending     = queue.filter(i => i.status === 'pending')
    const activeCount = queue.filter(i => i.status === 'downloading').length
    const slots       = maxConcurrent - activeCount

    for (let i = 0; i < Math.min(slots, pending.length); i++) {
      const item = pending[i]
      updateItem(item.id, { status: 'downloading', progress: { percent: 0, speed: 0, eta: 0, downloaded: 0, total: 0 } })
      downloadItem(item, onProgress, onDone, onError)
    }

    const scheduled  = queue.filter(i => i.status === 'scheduled').length
    if (pending.length === 0 && activeCount === 0 && scheduled === 0 && queue.length > 0) {
      setIsRunning(false); runningRef.current = false
    }
  }, [queue, isRunning, maxConcurrent, onProgress, onDone, onError, updateItem])

  // ── Playlist fetch ─────────────────────────────────────────────────────────
  const fetchPlaylist = async () => {
    if (!playlistUrl.trim()) return
    setFetchingPL(true); setPlError(null); setPlaylistInfo(null); setSelected(new Set())
    try {
      const { data } = await axios.post('/api/playlist-info', { url: playlistUrl.trim() })
      setPlaylistInfo(data)
      setSelected(new Set(data.videos.map(v => v.id || v.url)))
    } catch (err) { setPlError(err.response?.data?.detail || 'Failed to fetch playlist.') }
    finally { setFetchingPL(false) }
  }

  const toggleSelect = (key) => setSelected(prev => { const next = new Set(prev); next.has(key) ? next.delete(key) : next.add(key); return next })
  const selectAll    = () => setSelected(new Set(playlistInfo.videos.map(v => v.id || v.url)))
  const deselectAll  = () => setSelected(new Set())

  // ── Add to queue ───────────────────────────────────────────────────────────
  const buildOptions = () => ({ audioOnly, audioFormat, audioQuality, subtitles: false, formatId: 'bestvideo+bestaudio/best' })

  const addBulkUrls = () => {
    const urls  = bulkText.split('\n').map(l => l.trim()).filter(l => l.startsWith('http'))
    const items = urls.map(url => ({
      id: crypto.randomUUID(), url, title: url, thumbnail: null, platform: 'unknown',
      status: 'pending', scheduledAt: null, progress: null, job_id: null, filename: null, errorMsg: null,
      options: buildOptions(),
    }))
    setQueue(q => [...q, ...items]); setBulkText('')
  }

  const addPlaylistItems = () => {
    if (!playlistInfo) return
    const videos = playlistInfo.videos.filter(v => selected.has(v.id || v.url))

    let schedTs = null
    if (plScheduleMode && plScheduledAt) {
      const ts = new Date(plScheduledAt).getTime()
      if (ts > Date.now()) schedTs = ts
    }

    const items = videos.map(v => ({
      id: crypto.randomUUID(), url: v.url, title: v.title, thumbnail: v.thumbnail,
      platform: playlistInfo.platform || 'unknown',
      status: schedTs ? 'scheduled' : 'pending',
      scheduledAt: schedTs,
      progress: null, job_id: null, filename: null, errorMsg: null,
      options: buildOptions(),
    }))
    setQueue(q => [...q, ...items])
    if (schedTs && !isRunning) { setIsRunning(true); runningRef.current = true }
  }

  const startQueue = () => {
    if (queue.filter(i => i.status === 'pending').length === 0) return
    if (scheduleMode && scheduledAt) {
      const delay = new Date(scheduledAt).getTime() - Date.now()
      if (delay > 0) { scheduleTimerRef.current = setTimeout(() => { setIsRunning(true); runningRef.current = true }, delay); return }
    }
    setIsRunning(true); runningRef.current = true
  }
  const stopQueue = () => { setIsRunning(false); runningRef.current = false; if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current) }
  const clearCompleted = () => setQueue(q => q.filter(i => ['pending','downloading','scheduled'].includes(i.status)))
  const clearAll = () => { stopQueue(); setQueue([]) }
  const saveFile = (job_id, filename) => { const a = document.createElement('a'); a.href = `/api/file/${job_id}`; a.download = filename || job_id; document.body.appendChild(a); a.click(); document.body.removeChild(a) }
  const retryItem = (item) => { updateItem(item.id, { status: 'pending', scheduledAt: null, progress: null, errorMsg: null, job_id: null, filename: null }); setIsRunning(true); runningRef.current = true }
  const stats = { scheduled: queue.filter(i => i.status==='scheduled').length, pending: queue.filter(i => i.status==='pending').length, downloading: queue.filter(i => i.status==='downloading').length, done: queue.filter(i => i.status==='done').length, error: queue.filter(i => i.status==='error').length }
  const minDateTime = new Date(Date.now() + 60000).toISOString().slice(0, 16)
  return <div><div className="card"><p>BulkTab loaded</p></div></div>
}
