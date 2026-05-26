import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import axios from 'axios'
import { ThemeProvider, useTheme } from './context/ThemeContext.jsx'
import { LangProvider, useLang }   from './context/LangContext.jsx'
import DownloaderTab from './components/DownloaderTab.jsx'
import BulkTab       from './components/BulkTab.jsx'
import HistoryTab    from './components/HistoryTab.jsx'
import SettingsTab   from './components/SettingsTab.jsx'

export const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

export default function App() {
  return (
    <ThemeProvider>
      <LangProvider>
        <AppInner />
      </LangProvider>
    </ThemeProvider>
  )
}

function AppInner() {
  const { toggle: toggleTheme, isDark } = useTheme()
  const { t, lang, changeLang, LANGS }  = useLang()
  const [activeTab, setActiveTab] = useState('download')
  const [settings, setSettings] = useState(null)
  useEffect(() => {
    axios.get('/api/settings').then(r => setSettings(r.data)).catch(() => {})
  }, [])
  const [historyKey, setHistoryKey] = useState(0)
  const onHistoryChanged = useCallback(() => setHistoryKey(k => k + 1), [])
  const [jumpUrl, setJumpUrl] = useState(null)
  const openInDownloader = useCallback((url) => { setJumpUrl(url); setActiveTab('download') }, [])
  const onJumpConsumed = useCallback(() => setJumpUrl(null), [])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const extUrl = params.get('url')
    if (extUrl) { openInDownloader(decodeURIComponent(extUrl)); window.history.replaceState({}, '', window.location.pathname) }
  }, [])
  const [backendOk, setBackendOk] = useState(null)
  useEffect(() => {
    const check = async () => {
      try { await fetch('/health', { signal: AbortSignal.timeout(3000) }); setBackendOk(true) }
      catch { setBackendOk(false) }
    }
    check(); const id = setInterval(check, 8000); return () => clearInterval(id)
  }, [])
  const [toasts, setToasts] = useState([])
  const showToast = useCallback((msg, type='info', dur=3500) => {
    const id = Date.now() + Math.random()
    setToasts(p => [...p, {id, message: msg, type}])
    setTimeout(() => setToasts(p => p.filter(x => x.id !== id)), dur)
  }, [])
  const TABS = [
    { id: 'download', label: `⬇ ${t('tab_download')}` },
    { id: 'bulk', label: `📋 ${t('tab_bulk')}` },
    { id: 'history', label: `🕒 ${t('tab_history')}` },
    { id: 'settings', label: `⚙️ ${t('tab_settings')}` },
  ]
  return (
    <ToastContext.Provider value={showToast}>
      <div className="app">
        <header className="header">
          <div className="header-title-row">
            <h1>⬇ {t('app_title')}</h1>
            <BackendBadge ok={backendOk} t={t} />
          </div>
          <p>{t('app_subtitle')}</p>
          <div className="header-controls">
            <div className="lang-selector">
              {LANGS.map(l => (
                <button key={l.code} className={`lang-btn ${lang===l.code?'lang-active':''}`} onClick={()=>changeLang(l.code)} title={l.label}>
                  <span>{l.flag}</span><span className="lang-label">{l.code.toUpperCase()}</span>
                </button>
              ))}
            </div>
            <button className="theme-toggle" onClick={toggleTheme} title={isDark?'Light mode':'Dark mode'}>
              {isDark?'☀️':'🌙'}
            </button>
          </div>
        </header>
        {backendOk===false&&(<div className="banner-error">⚨️ {t('backend_warning')}</div>)}
        <nav className="tab-nav">
          {TABS.map(tab=>(<button key={tab.id} className={`tab-btn ${activeTab===tab.id?'active':''}`} onClick={()=>setActiveTab(tab.id)}>{tab.label}</button>))}
        </nav>
        <main>
          {activeTab==='download'&&<DownloaderTab settings={settings} onHistoryChanged={onHistoryChanged} jumpUrl={jumpUrl} onJumpConsumed={onJumpConsumed}/>}
          {activeTab==='bulk'&&<BulkTab settings={settings} onHistoryChanged={onHistoryChanged}/>}
          {activeTab==='history'&&<HistoryTab refreshKey={historyKey} onOpenInDownloader={openInDownloader}/>}
          {activeTab==='settings'&&<SettingsTab settings={settings} onSaved={setSettings}/>}
        </main>
        <div className="toast-stack">
          {toasts.map(x=>(<div key={x.id} className={`toast toast-${x.type}`}>{x.message}</div>))}
        </div>
      </div>
    </ToastContext.Provider>
  )
}

function BackendBadge({ ok, t }) {
  if(ok===null) return <span className="backend-badge badge-checking">{t('backend_checking')}</span>
  if(ok) return <span className="backend-badge badge-ok">● {t('backend_ok')}</span>
  return <span className="backend-badge badge-down">● {t('backend_down')}</span>
}
