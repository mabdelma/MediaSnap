import { useState } from 'react'
import axios from 'axios'
import { useToast } from '../App.jsx'
import { useLang } from '../context/LangContext.jsx'

const QUALITY_OPTIONS = [
  { value: 'bestvideo+bestaudio/best',                                     labelKey: 'quality_best'  },
  { value: 'bestvideo[height<=2160]+bestaudio/best[height<=2160]',         labelKey: 'quality_4k'    },
  { value: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',         labelKey: 'quality_1080'  },
  { value: 'bestvideo[height<=720]+bestaudio/best[height<=720]',           labelKey: 'quality_720'   },
  { value: 'bestvideo[height<=480]+bestaudio/best[height<=480]',           labelKey: 'quality_480'   },
  { value: 'bestvideo[height<=360]+bestaudio/best[height<=360]',           labelKey: 'quality_360'   },
]
const AUDIO_FORMATS    = ['mp3', 'm4a', 'wav', 'ogg', 'flac', 'opus']
const AUDIO_QUALITIES  = [
  { value: '0',   labelKey: 'aq_best' },
  { value: '320', labelKey: 'aq_320'  },
  { value: '256', labelKey: 'aq_256'  },
  { value: '192', labelKey: 'aq_192'  },
  { value: '128', labelKey: 'aq_128'  },
  { value: '64',  labelKey: 'aq_64'   },
]
const CLEANUP_OPTIONS  = [
  { value: 0,   labelKey: 'cleanup_never' },
  { value: 1,   labelKey: 'cleanup_1h'   },
  { value: 24,  labelKey: 'cleanup_24h'  },
  { value: 168, labelKey: 'cleanup_7d'   },
]
const COOKIE_BROWSERS  = [
  { value: '',        label: 'Disabled' },
  { value: 'chrome',  label: 'Chrome'   },
  { value: 'firefox', label: 'Firefox'  },
  { value: 'edge',    label: 'Edge'     },
  { value: 'safari',  label: 'Safari'   },
  { value: 'brave',   label: 'Brave'    },
]

export default function SettingsTab({ settings, onSaved }) {
  const toast = useToast()
  const { t } = useLang()

  const [form,   setForm]   = useState({ ...settings })
  const [saving, setSaving] = useState(false)

  const set = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const save = async () => {
    setSaving(true)
    try {
      const { data } = await axios.put('/api/settings', form)
      onSaved?.(data)
      toast?.(t('settings_saved'), 'success')
    } catch (err) {
      toast?.(`❌ ${err.response?.data?.detail || t('settings_failed')}`, 'error')
    } finally { setSaving(false) }
  }

  const reload = async () => {
    try { const { data } = await axios.get('/api/settings'); setForm(data); toast?.(t('settings_reloaded'), 'info') }
    catch (_) {}
  }

  const notifPermission = typeof Notification !== 'undefined' ? Notification.permission : 'unavailable'
  const requestNotifPermission = async () => {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    if (perm === 'granted') toast?.(t('notify_granted'), 'success')
    else                    toast?.(t('notify_denied'),  'error')
  }

  return (
    <div>
      <div className="card">
        <h3 style={{ marginBottom: '1.5rem', fontWeight: 700 }}>⚙️ {t('settings_title')}</h3>

        <fieldset className="settings-section">
          <legend>{t('section_defaults')}</legend>
          <div className="form-row">
            <div className="form-group">
              <label>{t('default_quality')}</label>
              <select className="select" value={form.default_quality} onChange={e => set('default_quality', e.target.value)}>
                {QUALITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('default_audio_format')}</label>
              <select className="select" value={form.default_audio_format} onChange={e => set('default_audio_format', e.target.value)}>
                {AUDIO_FORMATS.map(f => <option key={f} value={f}>{f.toUpperCase()}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('default_audio_quality')}</label>
              <select className="select" value={form.default_audio_quality || '0'} onChange={e => set('default_audio_quality', e.target.value)}>
                {AUDIO_QUALITIES.map(q => <option key={q.value} value={q.value}>{t(q.labelKey)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>{t('default_subtitle_lang')} <span className="text-muted">{t('subtitle_lang_hint')}</span></label>
              <input className="url-input" style={{ padding: '0.6rem 0.9rem' }} placeholder={t('subtitle_lang_ph')} value={form.subtitle_lang} onChange={e => set('subtitle_lang', e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>{t('max_concurrent')}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', paddingTop: '0.5rem' }}>
                <input type="range" min={1} max={5} step={1} value={form.max_concurrent} onChange={e => set('max_concurrent', parseInt(e.target.value))} className="range-input" />
                <span className="concurrent-badge">{form.max_concurrent}</span>
              </div>
            </div>
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.4rem' }}>{t('default_subtitles')}</label>
              <label className="toggle">
                <input type="checkbox" checked={!!form.default_subtitles} onChange={e => set('default_subtitles', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.4rem' }}>{t('default_thumbnail')}</label>
              <label className="toggle">
                <input type="checkbox" checked={!!form.default_thumbnail} onChange={e => set('default_thumbnail', e.target.checked)} />
                <span className="toggle-slider" />
              </label>
            </div>
          </div>
        </fieldset>

        <fieldset className="settings-section">
          <legend>{t('section_speed')}</legend>
          <div className="form-row">
            <div className="form-group">
              <label>{t('speed_limit_label')}</label>
              <input className="url-input" style={{ padding: '0.6rem 0.9rem' }} placeholder={t('speed_limit_ph')} value={form.speed_limit || ''} onChange={e => set('speed_limit', e.target.value)} />
              <p className="setting-hint">{t('speed_limit_hint')}</p>
            </div>
          </div>
        </fieldset>

        <fieldset className="settings-section">
          <legend>{t('section_cookies')}</legend>
          <div className="form-row">
            <div className="form-group">
              <label>{t('cookie_browser_label')}</label>
              <select className="select" value={form.cookie_browser || ''} onChange={e => set('cookie_browser', e.target.value)}>
                {COOKIE_BROWSERS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
              <p className="setting-hint">{t('cookie_browser_hint')}</p>
            </div>
          </div>
        </fieldset>

        <fieldset className="settings-section">
          <legend>{t('section_cleanup')}</legend>
          <div className="form-row">
            <div className="form-group">
              <label>{t('cleanup_label')}</label>
              <select className="select" value={form.cleanup_after_hours ?? 0} onChange={e => set('cleanup_after_hours', parseInt(e.target.value))}>
                {CLEANUP_OPTIONS.map(o => <option key={o.value} value={o.value}>{t(o.labelKey)}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="settings-section">
          <legend>{t('section_notifications')}</legend>
          <div className="form-row">
            <div className="form-group">
              <label style={{ display: 'block', marginBottom: '0.5rem' }}>
                {t('notif_permission_label')}: <strong>{notifPermission}</strong>
              </label>
              {notifPermission !== 'granted' && notifPermission !== 'unavailable' && (
                <button className="btn btn-ghost" onClick={requestNotifPermission}>{t('btn_request_notif')}</button>
              )}
            </div>
          </div>
        </fieldset>

        <div className="action-row" style={{ marginTop: '1.5rem' }}>
          <button className="btn btn-primary btn-lg" onClick={save} disabled={saving}>
            {saving ? <><span className="spinner" />{t('btn_saving')}</> : `💾 ${t('btn_save_settings')}`}
          </button>
          <button className="btn btn-ghost" onClick={reload}>{t('btn_reload_settings')}</button>
        </div>
      </div>
    </div>
  )
}
