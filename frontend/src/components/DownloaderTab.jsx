import { useState, useCallback, useEffect, useRef } from 'react'
import axios from 'axios'
import ProgressBar from './ProgressBar.jsx'
import { formatBytes, formatDuration } from '../utils/format.js'
import { useToast } from '../App.jsx'
import { useLang } from '../context/LangContext.jsx'

const AUDIO_FORMATS  = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'opus']
const AUDIO_QUALITIES = [
  { value: '0',   labelKey: 'aq_best' },
  { value: '320', labelKey: 'aq_320'  },
  { value: '256', labelKey: 'aq_256'  },
  { value: '192', labelKey: 'aq_192'  },
  { value: '128', labelKey: 'aq_128'  },
  { value: '64',  labelKey: 'aq_64'   },
]

const ORIGINAL_TITLE = document.title

function fireNotification(title, body) {
  if (typeof Notification === 'undefined') return
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' })
  }
}

export default function DownloaderTab({ settings, onHistoryChanged, jumpUrl, onJumpConsumed }) {
  const toast = useToast()
  const { t }  = useLang()

  const [url,         setUrl]         = useState('')
  const [info,        setInfo]        = useState(null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [infoError,   setInfoError]   = useState(null)

  const [audioOnly,      setAudioOnly]      = useState(false)
  const [selectedFormat, setSelectedFormat] = useState('')
  const [audioFormat,    setAudioFormat]    = useState(settings?.default_audio_format  || 'mp3')
  const [audioQuality,   setAudioQuality]   = useState(settings?.default_audio_quality || '0')
  const [subtitles,      setSubtitles]      = useState(settings?.default_subtitles     || false)
  const [subtitleLang,   setSubtitleLang]   = useState(settings?.subtitle_lang         || 'en')
  const [dlThumbnail,    setDlThumbnail]    = useState(settings?.default_thumbnail     || false)

  // Scheduling
  const [scheduleMode,   setScheduleMode]   = useState(false)
  const [scheduledAt,    setScheduledAt]    = useState('')
  const [scheduleStatus, setScheduleStatus] = useState(null)
  const scheduleTimerRef = useRef(null)

  const [downloading,    setDownloading]    = useState(false)
  const [progress,       setProgress]       = useState(null)
  const [downloadStatus, setDownloadStatus] = useState(null)
  const [readyFile,      setReadyFile]      = useState(null)

  const urlInputRef = useRef(null)

  // ── Handle jump-to-url from History / extension ──────────────────────────
  useEffect(() => {
    if (jumpUrl) { setUrl(jumpUrl); onJumpConsumed?.() }
  }, [jumpUrl, onJumpConsumed])

  useEffect(() => {
    if (jumpUrl) fetchInfo(jumpUrl)
  }, [jumpUrl]) // eslint-disable-line

  // ── Restore page title on unmount ────────────────────────────────────────
  useEffect(() => () => {
    document.title = ORIGINAL_TITLE
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current)
  }, [])

  // ── Clipboard paste ───────────────────────────────────────────────────────
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text.startsWith('http')) { setUrl(text.trim()); toast?.(t('btn_paste') + ' ✓', 'success') }
      else toast?.('Clipboard does not contain a URL', 'error')
    } catch { toast?.('Clipboard access denied — paste manually', 'error') }
  }

  // ── Fetch info ────────────────────────────────────────────────────────────
  const fetchInfo = useCallback(async (overrideUrl) => {
    const target = (overrideUrl || url).trim()
    if (!target) return
    setLoadingInfo(true); setInfoError(null); setInfo(null)
    setReadyFile(null); setDownloadStatus(null); setProgress(null); setScheduleStatus(null)
    try {
      const { data } = await axios.post('/api/info', { url: target })
      setInfo(data)
      setSelectedFormat(data.formats?.[0]?.format_id || 'bestvideo+bestaudio/best')
    } catch (err) {
      const raw = err.response?.data?.detail || ''
      setInfoError(friendlyError(raw) || 'Could not fetch video info. Check the URL and try again.')
    } finally { setLoadingInfo(false) }
  }, [url])

  // ── Schedule helper ───────────────────────────────────────────────────────
  const scheduleDownload = useCallback(() => {
    if (!scheduledAt) return
    const delay = new Date(scheduledAt).getTime() - Date.now()
    if (delay <= 0) { toast?.('Scheduled time is in the past', 'error'); return }
    setScheduleStatus(t('scheduled_for', { time: new Date(scheduledAt).toLocaleString() }))
    scheduleTimerRef.current = setTimeout(() => { setScheduleStatus(null); startDownload() }, delay)
  }, [scheduledAt, t]) // eslint-disable-line

  // ── Download ──────────────────────────────────────────────────────────────
  const startDownload = useCallback(async () => {
    if (!info) return
    setDownloading(true)
    setProgress({ percent: 0, speed: 0, eta: 0, downloaded: 0, total: 0 })
    setDownloadStatus({ type: 'info', msg: t('status_starting') })
    setReadyFile(null)
    document.title = `(0%) ${t('app_title')}`

    const qualityLabel = audioOnly
      ? `Audio · ${audioFormat.toUpperCase()}`
      : (info.formats?.find(f => f.format_id === selectedFormat)?.label || 'Best Quality')

    const body = {
      url:           url.trim(),
      format_id:     audioOnly ? 'bestaudio/best' : selectedFormat,
      audio_only:    audioOnly,
      audio_format:  audioOnly ? audioFormat  : undefined,
      audio_quality: audioOnly ? audioQuality : undefined,
      subtitles,
      subtitle_lang: subtitleLang,
      thumbnail:     dlThumbnail,
      title:         info.title,
      thumbnail_url: info.thumbnail,
      platform:      info.platform,
      quality_label: qualityLabel,
    }

    try {
      const response = await fetch('/api/download', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (!response.ok) {
        const errData = await response.json()
        throw new Error(errData.detail || 'Download request failed')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n'); buffer = lines.pop()
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const msg = JSON.parse(line.slice(6))
            if (msg.event === 'progress') {
              setProgress({ percent: msg.percent, speed: msg.speed, eta: msg.eta, downloaded: msg.downloaded, total: msg.total })
              setDownloadStatus({ type: 'info', msg: t('status_downloading', { pct: msg.percent.toFixed(1) }) })
              document.title = `(${msg.percent.toFixed(0)}%) ${t('app_title')}`
            } else if (msg.event === 'ready') {
              setReadyFile({ job_id: msg.file_id, filename: msg.filename })
              setDownloadStatus({ type: 'success', msg: t('status_complete') })
              document.title = `✅ ${t('app_title')}`
              onHistoryChanged?.()
              toast?.(t('notify_ready_body', { title: info.title }), 'success')
              fireNotification(t('notify_ready_title'), t('notify_ready_body', { title: info.title }))
            } else if (msg.event === 'error') {
              setDownloadStatus({ type: 'error', msg: `❌ ${friendlyError(msg.message)}` })
              document.title = ORIGINAL_TITLE
            }
          } catch (_) {}
        }
      }
    } catch (err) {
      setDownloadStatus({ type: 'error', msg: `❌ ${friendlyError(err.message) || err.message}` })
      document.title = ORIGINAL_TITLE
    } finally { setDownloading(false) }
  }, [info, url, audioOnly, selectedFormat, audioFormat, audioQuality, subtitles, subtitleLang, dlThumbnail, onHistoryChanged, toast, t])

  const saveFile = (job_id, filename) => {
    const a = document.createElement('a'); a.href = `/api/file/${job_id}`; a.download = filename || job_id
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    document.title = ORIGINAL_TITLE
    toast?.(t('saved_file'), 'success')
  }

  const reset = () => {
    setInfo(null); setUrl(''); setReadyFile(null); setDownloadStatus(null); setProgress(null); setScheduleStatus(null)
    if (scheduleTimerRef.current) clearTimeout(scheduleTimerRef.current)
    document.title = ORIGINAL_TITLE
  }

  const availableLangs = [...new Set([...(info?.subtitles || []), ...(info?.auto_subtitles || [])])].filter(Boolean)

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* URL input */}
      <div className="card">
        <div className="url-form">
          <input
            ref={urlInputRef}
            className="url-input" type="url"
            placeholder={t('url_placeholder')}
            value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && fetchInfo()}
            disabled={loadingInfo || downloading}
          />
          <button className="btn btn-ghost" onClick={pasteFromClipboard} title={t('btn_paste')} disabled={loadingInfo || downloading}>📋</button>
          <button className="btn btn-primary" onClick={() => fetchInfo()} disabled={!url.trim() || loadingInfo || downloading}>
            {loadingInfo ? <><span className="spinner" />{t('btn_fetching')}</> : `🔍 ${t('btn_fetch')}`}
          </button>
        </div>
        {infoError && <div className="status-msg status-error">{infoError}</div>}
      </div>

      {/* Video info + options */}
      {info && (
        <div className="card">
          <div className="video-info">
            {info.thumbnail && <img className="thumbnail" src={info.thumbnail} alt="thumbnail" loading="lazy" />}
            <div className="video-meta">
              <span className="platform-tag">{info.platform}</span>
              <h2>{info.title}</h2>
              {info.uploader && <div className="meta-row">👤 {info.uploader}</div>}
              {info.duration  && <div className="meta-row">⏱ {formatDuration(info.duration)}</div>}
              {(info.subtitles?.length > 0 || info.auto_subtitles?.length > 0) && (
                <div className="meta-row">💬 {[...info.subtitles, ...info.auto_subtitles].slice(0, 6).join(', ')}{[...info.subtitles, ...info.auto_subtitles].length > 6 ? '…' : ''}</div>
              )}
            </div>
          </div>

          <hr className="divider" />

          {/* Toggles */}
          <div className="toggles-row">
            <Toggle label={`🎵 ${t('toggle_audio_only')}`} checked={audioOnly}    onChange={setAudioOnly}    disabled={downloading} />
            <Toggle label={`💬 ${t('toggle_subtitles')}`}  checked={subtitles}    onChange={setSubtitles}    disabled={downloading || audioOnly} />
          
          <Toggle label={`🖼 ${t('toggle_thumbnail')}`}  checked={dlThumbnail}  onChange={setDlThumbnail}  disabled={downloading} />
        </div>

        {audioOnly && (
          <div className="options-grid" style={{ marginTop: '0.75rem' }}>
            <div className="option-group">
              <label>{t('audio_format')}</label>
              <select className="select" value={audioFormat} onChange={e => setAudioFormat(e.target.value)}>
                {AUDIO_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
            <div className="option-group">
              <label>{t('audio_quality')}</label>
              <select className="select" value={audioQuality} onChange={e => setAudioQuality(e.target.value)}>
                {AUDIO_QUALITIES.map(q => <option key={q.value} value={q.value}>{t(q.labelKey)}</option>)}
              </select>
            </div>
          </div>
        )}

        {subtitles && !audioOnly && availableLangs.length > 0 && (
          <div className="option-group" style={{ marginTop: '0.75rem' }}>
            <label>{t('subtitle_lang')}</label>
            <select className="select" value={subtitleLang} onChange={e => setSubtitleLang(e.target.value)}>
              {availableLangs.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        )}

        {!audioOnly && info.formats?.length > 0 && (
          <div style={{ marginTop: '1rem' }}>
            <label className="option-label">{t('quality_label')}</label>
            <div className="format-grid">
              {info.formats.map(f => (
                <div key={f.format_id}
                  className={`format-card ${selectedFormat === f.format_id ? 'selected' : ''}`}
                  onClick={() => setSelectedFormat(f.format_id)}>
                  <span className="format-label">{f.label}</span>
                  {f.filesize && <span className="format-size">{formatBytes(f.filesize)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="option-group" style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', paddingTop: '0.3rem' }}>
            <label className="toggle">
              <input type="checkbox" checked={scheduleMode} onChange={e => setScheduleMode(e.target.checked)} />
              <span className="toggle-slider" />
            </label>
            <span className="toggle-label">⏰ {t('schedule_label')}</span>
          </div>
        </div>
        {scheduleMode && (
          <div className="option-group">
            <label>{t('schedule_at_label')}</label>
            <input
              type="datetime-local" className="url-input schedule-input"
              value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
              min={new Date(Date.now() + 60000).toISOString().slice(0, 16)}
            />
          </div>
        )}
        {scheduleStatus && <div className="status-msg status-info">{scheduleStatus}</div>}

        <hr className="divider" />

        <div className="action-row">
          {!scheduleMode
            ? <button className="btn btn-primary btn-lg" onClick={startDownload} disabled={downloading || !info}>
                {downloading ? <><span className="spinner" />{t('btn_fetching')}</> : `⬇ ${t('btn_download')}`}
              </button>
            : <button className="btn btn-primary" onClick={scheduleDownload} disabled={!scheduledAt || downloading}>
                ⏰ {t('btn_schedule')}
              </button>
          }
          {(downloadStatus || readyFile) && (
            <button className="btn btn-ghost" onClick={reset}>{t('btn_reset')}</button>
          )}
        </div>

        {progress && (
          <ProgressBar
            percent={progress.percent} speed={progress.speed} eta={progress.eta}
            downloaded={progress.downloaded} total={progress.total}
          />
        )}

        {downloadStatus && (
          <div className={`status-msg status-${downloadStatus.type}`}>{downloadStatus.msg}</div>
        )}

        {readyFile && (
          <div className="action-row" style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-success btn-lg" onClick={() => saveFile(readyFile.job_id, readyFile.filename)}>
              ⬇ {t('btn_save')}
            </button>
          </div>
        )}
      </div>
    )}
  </div>
)
}

function Toggle({ label, checked, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <label className="toggle">
        <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} disabled={disabled} />
        <span className="toggle-slider" />
      </label>
      <span className="toggle-label">{label}</span>
    </div>
  )
}

function friendlyError(msg) {
  if (!msg) return ''
  if (msg.includes('Unsupported URL')) return 'Unsupported URL. Check the link and try again.'
  if (msg.includes('Video unavailable')) return 'Video unavailable or private.'
  if (msg.includes('Sign in')) return 'This video requires sign-in.'
  if (msg.includes('age')) return 'Age-restricted content.'
  return msg
}
