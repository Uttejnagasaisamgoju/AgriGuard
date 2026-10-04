/**
 * AgriGuard Read Aloud Dual-Engine Speech Synthesis Service
 * Provides genuine, high-quality, native-sounding multilingual text-to-speech
 * using Web Speech API with smart neural voice selection, with automatic fallback
 * to high-fidelity backend cloud streaming audio (/api/translation/tts).
 */

import { LanguageCode } from '../types/i18n';
import { enhancePronunciation, splitIntoSentences } from '../utils/pronunciation';

// BCP-47 Language Tag Mapping
const BCP47_LANGUAGE_MAP: Record<LanguageCode, string> = {
  en: 'en-IN',
  te: 'te-IN',
  ta: 'ta-IN',
  kn: 'kn-IN',
  ml: 'ml-IN',
  mr: 'mr-IN',
  hi: 'hi-IN',
  tcy: 'kn-IN', // Tulu phonetics on Kannada engine
  kok: 'mr-IN', // Konkani phonetics on Marathi engine
  kfa: 'kn-IN', // Kodava phonetics on Kannada engine
  bgy: 'kn-IN', // Beary phonetics on Kannada engine
  bfq: 'ta-IN', // Badaga phonetics on Tamil engine
};

export interface SpeakOptions {
  lang?: LanguageCode;
  rate?: number;
  pitch?: number;
  volume?: number;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (err: any) => void;
  onSentenceChange?: (sentence: string, index: number, total: number) => void;
}

class ReadAloudService {
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private currentAudio: HTMLAudioElement | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private voicesLoaded = false;
  private isSpeakingActive = false;
  private isPausedState = false;
  private activeSentenceIndex = 0;
  private activeSentences: string[] = [];
  private currentOptions: SpeakOptions = {};
  private activeLang: LanguageCode = 'en';

  constructor() {
    this.initVoices();
  }

  private initVoices() {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const updateVoices = () => {
      this.voices = window.speechSynthesis.getVoices();
      if (this.voices.length > 0) {
        this.voicesLoaded = true;
      }
    };

    updateVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = updateVoices;
    }
  }

  public getAvailableVoices(): SpeechSynthesisVoice[] {
    if (!this.voicesLoaded && typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.voices = window.speechSynthesis.getVoices();
    }
    return this.voices;
  }

  /**
   * Find the best voice for the target language, favoring high-definition neural voices
   */
  private findBestVoice(langCode: LanguageCode): SpeechSynthesisVoice | null {
    const bcp47 = BCP47_LANGUAGE_MAP[langCode] || 'en-IN';
    const primaryCode = bcp47.split('-')[0].toLowerCase();
    const voices = this.getAvailableVoices();

    if (!voices || voices.length === 0) return null;

    // 1. Look for exact BCP-47 match with high quality neural/natural markers
    const exactNeural = voices.find(
      (v) =>
        v.lang.toLowerCase() === bcp47.toLowerCase() &&
        (v.name.toLowerCase().includes('google') ||
          v.name.toLowerCase().includes('natural') ||
          v.name.toLowerCase().includes('neural') ||
          v.name.toLowerCase().includes('microsoft'))
    );
    if (exactNeural) return exactNeural;

    // 2. Look for exact BCP-47 match
    const exact = voices.find((v) => v.lang.toLowerCase() === bcp47.toLowerCase());
    if (exact) return exact;

    // 3. Look for primary language prefix (e.g. "te", "ta", "hi")
    const primaryMatch = voices.find((v) => v.lang.toLowerCase().startsWith(primaryCode));
    if (primaryMatch) return primaryMatch;

    // 4. If English, look for en-IN, en-US, en-GB
    if (primaryCode === 'en') {
      const enVoice = voices.find(
        (v) =>
          v.lang.toLowerCase().includes('en-in') ||
          v.lang.toLowerCase().includes('en-us') ||
          v.lang.toLowerCase().includes('en-gb')
      );
      if (enVoice) return enVoice;
    }

    return null;
  }

  /**
   * Play speech using cloud audio stream from AgriGuard backend
   */
  private playCloudTts(
    text: string,
    lang: LanguageCode,
    options: SpeakOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      this.cleanupMedia();

      const encoded = encodeURIComponent(text.slice(0, 1000));
      // Cloud TTS proxy endpoint
      const audioUrl = `/api/translation/tts?text=${encoded}&lang=${lang}`;

      const audio = new Audio(audioUrl);
      this.currentAudio = audio;
      audio.playbackRate = options.rate || 1.0;
      audio.volume = options.volume !== undefined ? options.volume : 1.0;

      audio.onplay = () => {
        this.isSpeakingActive = true;
        this.isPausedState = false;
        options.onStart?.();
      };

      audio.onended = () => {
        this.isSpeakingActive = false;
        this.isPausedState = false;
        options.onEnd?.();
        resolve();
      };

      audio.onerror = (e) => {
        this.isSpeakingActive = false;
        options.onError?.(e);
        reject(e);
      };

      audio.play().catch((err) => {
        console.warn('Cloud audio playback blocked or failed:', err);
        options.onError?.(err);
        reject(err);
      });
    });
  }

  /**
   * Speak a block of text cleanly, chunking sentences for long content
   */
  public async speak(text: string, options: SpeakOptions = {}): Promise<void> {
    // 1. Clean and enhance pronunciation
    const lang = options.lang || 'en';
    this.activeLang = lang;
    this.currentOptions = options;
    const enhanced = enhancePronunciation(text, lang);

    if (!enhanced) {
      options.onEnd?.();
      return;
    }

    // 2. Stop any existing audio immediately
    this.stop();

    // 3. Split into natural sentence chunks to support long advisory / reports without timeouts
    const sentences = splitIntoSentences(enhanced);
    if (sentences.length === 0) {
      options.onEnd?.();
      return;
    }

    this.activeSentences = sentences;
    this.activeSentenceIndex = 0;
    this.isSpeakingActive = true;
    this.isPausedState = false;

    // 4. Play sentences sequentially
    await this.playSentenceSequence(0);
  }

  private async playSentenceSequence(startIndex: number) {
    if (!this.isSpeakingActive) return;

    for (let i = startIndex; i < this.activeSentences.length; i++) {
      if (!this.isSpeakingActive) break;

      this.activeSentenceIndex = i;
      const sentence = this.activeSentences[i];
      this.currentOptions.onSentenceChange?.(sentence, i, this.activeSentences.length);

      try {
        await this.speakSingleChunk(sentence, this.activeLang, this.currentOptions);
      } catch (err) {
        console.warn(`Error speaking sentence chunk ${i}:`, err);
      }
    }

    if (this.isSpeakingActive && this.activeSentenceIndex >= this.activeSentences.length - 1) {
      this.isSpeakingActive = false;
      this.isPausedState = false;
      this.currentOptions.onEnd?.();
    }
  }

  /**
   * Speak a single chunk using Web Speech API or Cloud TTS fallback
   */
  private speakSingleChunk(
    chunk: string,
    lang: LanguageCode,
    options: SpeakOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      if (typeof window === 'undefined') {
        resolve();
        return;
      }

      const hasSpeech = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
      const bestVoice = this.findBestVoice(lang);

      // If Web Speech synthesis is available and either we have a voice or it's English, try native
      if (hasSpeech && (bestVoice || lang === 'en')) {
        try {
          window.speechSynthesis.cancel();

          const utterance = new SpeechSynthesisUtterance(chunk);
          this.currentUtterance = utterance;

          const bcp47 = BCP47_LANGUAGE_MAP[lang] || 'en-IN';
          utterance.lang = bcp47;
          if (bestVoice) {
            utterance.voice = bestVoice;
          }

          utterance.rate = options.rate || 0.95; // 0.95 for maximum agricultural clarity
          utterance.pitch = options.pitch || 1.0;
          utterance.volume = options.volume !== undefined ? options.volume : 1.0;

          utterance.onstart = () => {
            this.isSpeakingActive = true;
            this.isPausedState = false;
            options.onStart?.();
          };

          utterance.onend = () => {
            this.currentUtterance = null;
            resolve();
          };

          utterance.onerror = (e) => {
            console.warn('Native speech error, attempting cloud fallback:', e);
            this.currentUtterance = null;
            // Fallback to cloud TTS
            this.playCloudTts(chunk, lang, options).then(resolve).catch(reject);
          };

          window.speechSynthesis.speak(utterance);
          return;
        } catch (err) {
          console.warn('SpeechSynthesis invocation failed, using cloud fallback:', err);
        }
      }

      // Cloud TTS fallback for devices without target native voices
      this.playCloudTts(chunk, lang, options).then(resolve).catch(reject);
    });
  }

  public pause() {
    if (!this.isSpeakingActive || this.isPausedState) return;

    if (this.currentAudio && !this.currentAudio.paused) {
      this.currentAudio.pause();
      this.isPausedState = true;
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      this.isPausedState = true;
    }
  }

  public resume() {
    if (!this.isSpeakingActive || !this.isPausedState) return;

    if (this.currentAudio && this.currentAudio.paused) {
      this.currentAudio.play().catch(() => {});
      this.isPausedState = false;
    } else if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      this.isPausedState = false;
    } else {
      // Re-trigger from active sentence if needed
      this.isPausedState = false;
      this.playSentenceSequence(this.activeSentenceIndex);
    }
  }

  public stop() {
    this.isSpeakingActive = false;
    this.isPausedState = false;
    this.activeSentenceIndex = 0;
    this.activeSentences = [];

    this.cleanupMedia();
  }

  private cleanupMedia() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
        this.currentAudio.src = '';
      } catch {}
      this.currentAudio = null;
    }
    this.currentUtterance = null;
  }

  public isSpeaking(): boolean {
    return this.isSpeakingActive && !this.isPausedState;
  }

  public isPaused(): boolean {
    return this.isPausedState;
  }
}

export const readAloudService = new ReadAloudService();
