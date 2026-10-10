/**
 * Voice Command utility using Web Speech API
 * Supports Arabic speech recognition (webkitSpeechRecognition) and TTS (speechSynthesis)
 */

export const SPEECH_LANG = "ar-SA"; // Arabic (Saudi Arabia) - broad Arabic support

/**
 * Check if speech recognition is supported
 */
export function isSpeechRecognitionSupported() {
  return typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
}

/**
 * Check if speech synthesis is supported
 */
export function isSpeechSynthesisSupported() {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Get an Arabic voice for speech synthesis
 */
export function getArabicVoice() {
  if (!isSpeechSynthesisSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  // Prefer Arabic voices
  const arabicVoice = voices.find(v => v.lang.startsWith("ar")) ||
    voices.find(v => v.lang.startsWith("ar-")) ||
    voices[0];
  return arabicVoice || null;
}

/**
 * Speak text in Arabic using speechSynthesis
 */
export function speakArabic(text) {
  if (!isSpeechSynthesisSupported()) return;

  // Cancel any ongoing speech
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = SPEECH_LANG;
  utterance.rate = 1.0;
  utterance.pitch = 1.0;

  const arabicVoice = getArabicVoice();
  if (arabicVoice) {
    utterance.voice = arabicVoice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Stop any ongoing speech
 */
export function stopSpeaking() {
  if (isSpeechSynthesisSupported()) {
    window.speechSynthesis.cancel();
  }
}

/**
 * Create a speech recognition instance
 * Returns { recognition, isSupported }
 */
export function createSpeechRecognition(onResult, onError, onEnd) {
  if (!isSpeechRecognitionSupported()) {
    return { recognition: null, isSupported: false };
  }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();

  recognition.lang = SPEECH_LANG;
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const results = event.results;
    let finalTranscript = "";
    let interimTranscript = "";

    for (let i = event.resultIndex; i < results.length; i++) {
      const transcript = results[i][0].transcript;
      if (results[i].isFinal) {
        finalTranscript += transcript;
      } else {
        interimTranscript += transcript;
      }
    }

    onResult(finalTranscript, interimTranscript);
  };

  recognition.onerror = (event) => {
    // 'no-speech' is not really an error, just means user didn't say anything
    if (event.error !== "no-speech") {
      onError(event.error);
    }
  };

  recognition.onend = () => {
    if (onEnd) onEnd();
  };

  return { recognition, isSupported: true };
}
