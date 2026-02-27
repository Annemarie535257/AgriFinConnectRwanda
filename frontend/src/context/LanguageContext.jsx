import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { translations } from '../translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState(() => {
    const stored = localStorage.getItem('agrifinconnect-lang');
    return stored && translations[stored] ? stored : 'en';
  });

  useEffect(() => {
    document.documentElement.lang = language === 'rw' ? 'rw' : language === 'fr' ? 'fr' : 'en';
  }, [language]);

  const setLanguageAndStore = useCallback((lang) => {
    if (translations[lang]) {
      setLanguage(lang);
      localStorage.setItem('agrifinconnect-lang', lang);
    }
  }, []);

  const t = useCallback((key) => {
    const keys = key.split('.');
    let value = translations[language];
    for (const k of keys) {
      value = value?.[k];
    }
    return value ?? key;
  }, [language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage: setLanguageAndStore, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
  return ctx;
}
