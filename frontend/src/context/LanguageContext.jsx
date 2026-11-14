import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations } from '../i18n/translations';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  // Default to Telugu ('te') or saved preference
  const [lang, setLang] = useState(() => {
    return localStorage.getItem('kirana_lang') || 'te';
  });

  useEffect(() => {
    localStorage.setItem('kirana_lang', lang);
  }, [lang]);

  const switchLanguage = (newLang) => {
    if (newLang === 'en' || newLang === 'te') {
      setLang(newLang);
    }
  };

  const t = (key) => {
    return translations[lang]?.[key] || translations['en']?.[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ lang, switchLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within LanguageProvider');
  }
  return context;
}

