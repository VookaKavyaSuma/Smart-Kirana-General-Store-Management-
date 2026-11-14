import React from 'react';
import { useLanguage } from '../context/LanguageContext';
import { Globe } from 'lucide-react';

export default function LanguageToggle() {
  const { lang, switchLanguage } = useLanguage();

  return (
    <div className="inline-flex items-center bg-slate-100 p-1 rounded-full border border-slate-200 shadow-xs">
      <Globe className="w-4 h-4 text-slate-500 ml-2 mr-1" />
      <button
        type="button"
        onClick={() => switchLanguage('te')}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
          lang === 'te'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        తెలుగు
      </button>
      <button
        type="button"
        onClick={() => switchLanguage('en')}
        className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
          lang === 'en'
            ? 'bg-emerald-600 text-white shadow-xs'
            : 'text-slate-600 hover:text-slate-900'
        }`}
      >
        English
      </button>
    </div>
  );
}

