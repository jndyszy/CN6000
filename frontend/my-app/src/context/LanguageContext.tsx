import { createContext, useContext, useState } from 'react'
import { translations } from '../i18n/translations'

type Lang = 'en' | 'zh'

interface LanguageContextValue {
  lang: Lang
  t: (key: string, vars?: Record<string, string | number>) => string
  toggle: () => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  t: (key) => key,
  toggle: () => {},
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState<Lang>(
    () => (localStorage.getItem('lang') as Lang) || 'en'
  )

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = translations[lang][key] ?? key
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replace(`{${k}}`, String(v))
      })
    }
    return str
  }

  const toggle = () => {
    const next: Lang = lang === 'en' ? 'zh' : 'en'
    localStorage.setItem('lang', next)
    setLang(next)
  }

  return (
    <LanguageContext.Provider value={{ lang, t, toggle }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
