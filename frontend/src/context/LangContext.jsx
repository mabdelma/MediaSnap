import { createContext, useContext, useState, useEffect } from 'react'
import T from '../i18n/translations.js'

export const LANGS = [
  { code: 'en', label: 'English',    flag: '🇬🇧' },
  { code: 'ar', label: 'العربية',    flag: '🇸🇦' },
  { code: 'es', label: 'Español',    flag: '🇪🇸' },
  { code: 'fr', label: 'Français',   flag: '🇫🇷' },
  { code: 'pt', label: 'Português',  flag: '🇧🇷' },
]

const LangContext = createContext()

export function LangProvider({ children }) {
  const [lang, setLang] = useState(() => {
    const stored = localStorage.getItem('ms-lang')
    return stored && T[stored] ? stored : 'en'
  })

  // Apply dir + lang attributes on first render and on change
  useEffect(() => {
    const isRTL = lang === 'ar'
    document.documentElement.setAttribute('dir',  isRTL ? 'rtl' : 'ltr')
    document.documentElement.setAttribute('lang', lang)
  }, [lang])

  /** Translate key with optional {var} interpolation */
  const t = (key, vars = {}) => {
    const str = T[lang]?.[key] ?? T.en[key] ?? key
    return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`))
  }

  const changeLang = (code) => {
    if (!T[code]) return
    setLang(code)
    localStorage.setItem('ms-lang', code)
  }

  const isRTL = lang === 'ar'

  return (
    <LangContext.Provider value={{ lang, t, isRTL, changeLang, LANGS }}>
      {children}
    </LangContext.Provider>
  )
}

export const useLang = () => useContext(LangContext)
export default LangContext
