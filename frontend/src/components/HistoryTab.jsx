import { useState, useEffect, useCallback } from 'react'
import axios from 'axios'
import { formatBytes, formatTime, platformColor } from '../utils/format.js'
import { useToast } from '../App.jsx'
import { useLang } from '../context/LangContext.jsx'

export default function HistoryTab({ refreshKey, onOpenInDownloader }) {
  const toast = useToast()
  const { t } = useLang()

  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(false)
  const [filter,  setFilter]  = useState('all')
  const [search,  setSearch]  = useState('')

  const fetchHistory = useCallback(async () => {
    setLoading(true)
    try { const { data } = await axios.get('/api/history'); setHistory(data) } catch (_) {}
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory, refreshKey])

  const deleteItem = async (item) => {
    await axios.delete(`/api/history/${item.job_id}`).catch(() => {})
    await axios.delete(`/api/file/${item.job_id}`).catch(() => {})
    setHistory(h => h.filter(x => x.job_id !== item.job_id))
  }

  const clearAll = async () => {
    if (!confirm(t('confirm_clear_all'))) return
    for (const item of history) await axios.delete(`/api/file/${item.job_id}`).catch(() => {})
    await axios.delete('/api/history').catch(() => {})
    setHistory([])
  }

  const saveFile = (item) => {
    const a = document.createElement('a'); a.href = `/api/file/${item.job_id}`; a.download = item.filename || item.job_id
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    toast?.(t('saved_file'), 'success')
  }

  const copyUrl = async (item) => {
    try { await navigator.clipboard.writeText(`/api/file/${item.job_id}`); toast?.(t('copied_link'), 'success') }
    catch { toast?.('Could not copy to clipboard', 'error') }
  }

  const visible = history.filter(item => {
    if (filter !== 'all' && item.type !== filter) return false
    if (search && !item.title?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div>
      <div className="card">
        <div className="history-header">
          <h3>📋 {t('history_title')} <span className="text-muted">({visible.length})</span></h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchHistory}>{t('btn_refresh')}</button>
            {history.length > 0 && <button className="btn btn-danger btn-sm" onClick={clearAll}>{t('btn_clear_all')}</button>}
          </div>
        </div>

        <div className="filter-bar">
          <input
            className="url-input"
            style={{ flex: 1, padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
            placeholder={`🔍 ${t('history_search')}`}
            value={search} onChange={e => setSearch(e.target.value)}
          />
          <div className="filter-btns">
            {[
              { id: 'all',   label: `🌐 ${t('filter_all')}`   },
              { id: 'video', label: `🎬 ${t('filter_video')}` },
              { id: 'audio', label: `🎵 ${t('filter_audio')}` },
            ].map(f => (
              <button key={f.id} className={`btn btn-ghost btn-sm ${filter === f.id ? 'filter-active' : ''}`} onClick={() => setFilter(f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {loading && <div className="history-empty"><span className="spinner" /> Loading…</div>}

        {!loading && visible.length === 0 && (
          <div className="history-empty">{history.length === 0 ? t('history_empty') : t('history_no_results')}</div>
        )}

        {visible.map(item => (
          <div key={item.job_id} className="history-item">
            {item.thumbnail_url
              ? <img className="history-thumb" src={item.thumbnail_url} alt="" loading="lazy" />
              : <div className="thumb-placeholder">{item.type === 'audio' ? '🎵' : '🎬'}</div>
            }
            <div className="history-info">
              <div className="history-title">{item.title}</div>
              <div className="history-meta">
                <span className="platform-tag" style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem', background: platformColor(item.platform) }}>{item.platform}</span>
                {' '}{item.type === 'audio' ? '🎵' : '🎬'} {item.quality_label}
                {item.filesize > 0 && <> · {formatBytes(item.filesize)}</>}
              </div>
              <div className="history-meta" style={{ marginTop: '0.15rem' }}>🕒 {formatTime(item.timestamp)}</div>
            </div>
            <div className="history-actions">
              <button className="btn btn-success btn-sm" onClick={() => saveFile(item)} title={t('btn_save')}>💾</button>
              {onOpenInDownloader && item.source_url && (
                <button className="btn btn-primary btn-sm" onClick={() => onOpenInDownloader(item.source_url)} title="Re-download">↺</button>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => copyUrl(item)} title="Copy link">🔗</button>
              <button className="btn btn-danger btn-sm" onClick={() => deleteItem(item)} title={t('btn_delete')}>🖥</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
