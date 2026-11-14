import React, { useState } from 'react';
import { useLanguage } from '../../context/LanguageContext';
import { isSpeechRecognitionSupported, startVoiceListening } from '../../utils/speech';
import { Mic, MicOff, Loader2 } from 'lucide-react';

export default function VoiceMicButton({ onTranscript, title = 'Voice Input', className = '', size = 'md' }) {
  const { language } = useLanguage();
  const [isListening, setIsListening] = useState(false);

  // FR-2.7: Hide the microphone button when the browser does not support voice
  if (!isSpeechRecognitionSupported()) {
    return null;
  }

  const handleToggleVoice = (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (isListening) {
      setIsListening(false);
      return;
    }

    startVoiceListening({
      language,
      onStart: () => setIsListening(true),
      onResult: (transcript) => {
        setIsListening(false);
        if (onTranscript && transcript) {
          onTranscript(transcript.trim());
        }
      },
      onError: (err) => {
        setIsListening(false);
      },
      onEnd: () => setIsListening(false),
    });
  };

  const iconSizes = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };

  const btnPadding = {
    sm: 'p-1.5',
    md: 'p-2',
    lg: 'p-2.5',
  };

  return (
    <button
      type="button"
      onClick={handleToggleVoice}
      title={`${title} (${language === 'te' ? 'తెలుగు' : 'English'})`}
      className={`inline-flex items-center justify-center rounded-xl transition-all cursor-pointer ${
        isListening
          ? 'bg-rose-500 text-white animate-pulse shadow-md shadow-rose-500/40 ring-2 ring-rose-400'
          : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 active:scale-95'
      } ${btnPadding[size] || 'p-2'} ${className}`}
    >
      {isListening ? (
        <Mic className={`${iconSizes[size] || 'w-4 h-4'} animate-bounce`} />
      ) : (
        <Mic className={iconSizes[size] || 'w-4 h-4'} />
      )}
    </button>
  );
}

