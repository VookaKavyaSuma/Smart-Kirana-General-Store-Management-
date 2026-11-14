/**
 * Web Speech API Utility for Voice Input and Speech Synthesis (FR-2.4 to FR-2.7)
 * Supports Telugu (te-IN) and English (en-IN).
 */

export function isSpeechRecognitionSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

export function isSpeechSynthesisSupported() {
  if (typeof window === 'undefined') return false;
  return Boolean('speechSynthesis' in window && window.SpeechSynthesisUtterance);
}

/**
 * Start listening for voice input in chosen language (te-IN or en-IN)
 */
export function startVoiceListening({
  language = 'en',
  onResult,
  onError,
  onStart,
  onEnd,
}) {
  if (!isSpeechRecognitionSupported()) {
    if (onError) onError(new Error('Speech recognition is not supported in this browser.'));
    return () => {};
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  // te-IN for Telugu, en-IN for Indian English
  recognition.lang = language === 'te' ? 'te-IN' : 'en-IN';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  recognition.continuous = false;

  recognition.onstart = () => {
    if (onStart) onStart();
  };

  recognition.onresult = (event) => {
    if (event.results && event.results.length > 0) {
      const transcript = event.results[0][0].transcript;
      if (onResult) onResult(transcript);
    }
  };

  recognition.onerror = (event) => {
    console.warn('[VOICE INPUT ERROR]:', event.error);
    if (onError) onError(event);
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  try {
    recognition.start();
  } catch (err) {
    console.warn('[VOICE START ERROR]:', err);
    if (onError) onError(err);
  }

  return () => {
    try {
      recognition.abort();
    } catch (e) {
      // Ignore
    }
  };
}

/**
 * Speak text aloud using browser SpeechSynthesis (FR-2.6)
 */
export function speakText(text, language = 'en') {
  if (!isSpeechSynthesisSupported() || !text) return;

  try {
    // Cancel any active speech
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'te' ? 'te-IN' : 'en-IN';
    utterance.rate = 0.95; // comfortable cadence
    utterance.pitch = 1.0;

    // Optional: pick best matching voice
    const voices = window.speechSynthesis.getVoices();
    const targetLangPrefix = language === 'te' ? 'te' : 'en';
    const voice = voices.find((v) => v.lang.startsWith(targetLangPrefix));
    if (voice) {
      utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('[SPEECH SYNTHESIS ERROR]:', err);
  }
}

