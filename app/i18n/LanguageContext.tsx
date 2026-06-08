'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { translations, Lang, Translations } from './translations'

interface LanguageContextType {
  lang: Lang
  t: Translations
  setLang: (lang: Lang) => void
  toggleLang: () => void
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'es',
  t: translations.es,
  setLang: () => {},
  toggleLang: () => {},
})

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es')

  useEffect(() => {
    // Check localStorage first
    const saved = localStorage.getItem('rhr_lang') as Lang | null
    if (saved && (saved === 'es' || saved === 'en')) {
      setLangState(saved)
      return
    }
    // Auto-detect browser language
    const browserLang = navigator.language || (navigator as any).userLanguage || ''
    if (browserLang.startsWith('en')) {
      setLangState('en')
    } else {
      setLangState('es') // Default to Spanish
    }
  }, [])

  const setLang = (newLang: Lang) => {
    setLangState(newLang)
    localStorage.setItem('rhr_lang', newLang)
  }

  const toggleLang = () => {
    const newLang = lang === 'es' ? 'en' : 'es'
    setLang(newLang)
  }

  return (
    <LanguageContext.Provider value={{ lang, t: translations[lang], setLang, toggleLang }}>
      {children}
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => useContext(LanguageContext)
