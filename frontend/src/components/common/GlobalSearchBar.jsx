import React, { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { searchApi } from '../../services/api';
import { speakText } from '../../utils/speech';
import VoiceMicButton from './VoiceMicButton';
import {
  Search,
  X,
  Clock,
  Trash2,
  TrendingUp,
  Package,
  AlertCircle,
  Volume2,
  CheckCircle,
  Store,
  Sparkles,
} from 'lucide-react';

export default function GlobalSearchBar({ onSelectItem, onTriggerAddItem }) {
  const { t, language } = useLanguage();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Voice command response state (FR-2.6: Read aloud and show on screen)
  const [voiceToast, setVoiceToast] = useState(null);

  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch suggestions when search bar is focused or query changes
  const fetchSuggestions = async (filterText = '') => {
    try {
      const res = await searchApi.getSuggestions(filterText);
      if (res.success && res.suggestions) {
        setSuggestions(res.suggestions);
      }
    } catch (err) {
      console.warn('Failed to load suggestions:', err);
    }
  };

  // Debounced search (200 ms - FR-7.1, FR-7.6)
  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!query.trim()) {
      setResults([]);
      fetchSuggestions('');
      return;
    }

    debounceTimerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const [searchRes, suggRes] = await Promise.all([
          searchApi.search(query.trim()),
          searchApi.getSuggestions(query.trim()),
        ]);

        if (searchRes.success && searchRes.items) {
          setResults(searchRes.items);
        }
        if (suggRes.success && suggRes.suggestions) {
          setSuggestions(suggRes.suggestions);
        }
      } catch (err) {
        console.warn('Search query error:', err);
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(debounceTimerRef.current);
  }, [query]);

  const handleFocus = () => {
    setIsDropdownOpen(true);
    fetchSuggestions(query);
  };

  const handleSelectSuggestion = (searchWord) => {
    setQuery(searchWord);
    // Record into history
    searchApi.recordHistory(searchWord);
    setIsDropdownOpen(true);
  };

  const handleDeleteSuggestion = async (e, id) => {
    e.stopPropagation();
    try {
      await searchApi.deleteSuggestion(id);
      setSuggestions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      console.warn('Failed to delete suggestion:', err);
    }
  };

  const handleSelectItem = (item) => {
    setIsDropdownOpen(false);
    // Record search history for this item (FR-7.4)
    searchApi.recordHistory(item.name, item.id);
    if (onSelectItem) {
      onSelectItem(item);
    }
  };

  // Voice Input & Command handler (FR-2.4 to FR-2.7)
  const handleVoiceTranscript = async (transcript) => {
    if (!transcript) return;
    setQuery(transcript);
    setIsDropdownOpen(true);

    try {
      const res = await searchApi.voiceCommand(transcript, language);
      if (res.success) {
        // Read aloud with speech synthesis in chosen language (FR-2.6)
        if (res.spokenAnswer) {
          speakText(res.spokenAnswer, language);
        }

        // Show answer on screen (FR-2.6)
        setVoiceToast({
          text: res.displayText || res.spokenAnswer,
          action: res.action,
        });

        // If command was to add item, trigger callback
        if (res.action === 'add_item' && onTriggerAddItem) {
          onTriggerAddItem();
        }

        // If search results returned, display them directly
        if (res.action === 'search' && res.data?.items) {
          setResults(res.data.items);
        }

        // Auto dismiss voice toast after 6 seconds
        setTimeout(() => setVoiceToast(null), 6000);
      }
    } catch (err) {
      console.warn('Voice command processing error:', err);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-lg">
      {/* Search Input Container */}
      <div className="relative flex items-center">
        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          <Search className="w-4 h-4" />
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={handleFocus}
          placeholder={t('searchItemsPlaceholder') || 'Search items in English or తెలుగు...'}
          className="w-full pl-10 pr-20 py-2 sm:py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200/60 focus:bg-white text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 border border-slate-200/80 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 shadow-xs transition-all"
        />

        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery('');
                setResults([]);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Voice Microphone Button (FR-2.4, FR-2.7: Hidden if not supported) */}
          <VoiceMicButton
            onTranscript={handleVoiceTranscript}
            size="sm"
            title={t('voiceSearch') || 'Speak to search'}
          />
        </div>
      </div>

      {/* Voice Assistant Toast / On-Screen Answer Banner (FR-2.6) */}
      {voiceToast && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 p-3 rounded-2xl bg-emerald-950 text-white shadow-xl border border-emerald-700/50 flex items-start justify-between gap-3 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-emerald-700 flex items-center justify-center shrink-0 text-white mt-0.5">
              <Volume2 className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                Voice Assistant ({language === 'te' ? 'తెలుగు' : 'English'})
              </span>
              <p className="text-xs font-semibold text-white mt-0.5">
                {voiceToast.text}
              </p>
            </div>
          </div>
          <button
            onClick={() => setVoiceToast(null)}
            className="text-slate-400 hover:text-white p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Dropdown: Suggestions & Search Results */}
      {isDropdownOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden max-h-[450px] overflow-y-auto animate-in fade-in duration-100">
          {/* 1. Instant Item Search Results (FR-7.2: photo, name, remaining, SP, CP) */}
          {results.length > 0 && (
            <div className="p-2 border-b border-slate-100">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Items ({results.length})
              </div>
              <div className="space-y-1">
                {results.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleSelectItem(item)}
                    className="p-2.5 rounded-2xl hover:bg-slate-50 flex items-center justify-between gap-3 cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      {/* Photo or Icon (FR-7.2) */}
                      {item.photoUrl ? (
                        <img
                          src={item.photoUrl}
                          alt={item.name}
                          className="w-10 h-10 rounded-xl object-cover border border-slate-200"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center font-bold text-xs">
                          <Package className="w-5 h-5" />
                        </div>
                      )}

                      <div>
                        <h5 className="font-bold text-slate-900 text-xs sm:text-sm group-hover:text-emerald-700 transition-colors">
                          {item.name}
                        </h5>
                        <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5">
                          <span className={`font-semibold ${item.isLowStock ? 'text-rose-600 font-bold' : 'text-slate-600'}`}>
                            {item.quantityRemaining} {item.unit} left
                          </span>
                          <span>•</span>
                          <span className="font-mono">CP: ₹{item.costPrice}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 font-semibold block uppercase">SP</span>
                      <span className="font-mono font-black text-xs sm:text-sm text-slate-900">
                        ₹{item.sellingPrice}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 2. Frequent Search Suggestions (FR-7.3, FR-7.4, FR-7.7) */}
          {suggestions.length > 0 && (
            <div className="p-2 bg-slate-50/50">
              <div className="px-3 py-1.5 text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                <span>Frequent Searches (FR-7.3)</span>
              </div>

              <div className="space-y-0.5">
                {suggestions.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectSuggestion(s.searchWord)}
                    className="px-3 py-2 rounded-xl hover:bg-white flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer group transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Search className="w-3.5 h-3.5 text-slate-400" />
                      <span className="font-semibold text-slate-800">{s.searchWord}</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-slate-200/80 text-slate-600 font-mono font-bold" title="Search frequency">
                        {s.count}x
                      </span>
                    </div>

                    {/* Delete Suggestion Button (FR-7.7) */}
                    <button
                      type="button"
                      onClick={(e) => handleDeleteSuggestion(e, s.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-opacity"
                      title="Delete from history"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {query.trim() && results.length === 0 && !loading && (
            <div className="p-6 text-center text-xs text-slate-500">
              <p>No items found matching "<strong>{query}</strong>".</p>
              <p className="text-[11px] text-slate-400 mt-1">Try speaking in Telugu or English with the microphone button.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
