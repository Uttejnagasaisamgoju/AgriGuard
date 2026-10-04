import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useLanguage } from './LanguageContext';
import { readAloudService } from '../services/readAloudService';
import { formatStatSentence } from '../utils/pronunciation';

interface ReadAloudContextType {
  isEnabled: boolean;
  isSpeaking: boolean;
  isPaused: boolean;
  currentText: string;
  currentElement: HTMLElement | null;
  speechRate: number;
  toggleReadAloud: (forced?: boolean) => void;
  speak: (text: string, element?: HTMLElement) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  setSpeechRate: (rate: number) => void;
  testVoice: () => void;
}

const ReadAloudContext = createContext<ReadAloudContextType | undefined>(undefined);

const STORAGE_KEY = 'agriguard_read_aloud';
const RATE_KEY = 'agriguard_read_aloud_rate';

export const ReadAloudProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { language, t } = useLanguage();

  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return localStorage.getItem(STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const [speechRate, setSpeechRateState] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.95;
    try {
      const saved = localStorage.getItem(RATE_KEY);
      return saved ? parseFloat(saved) : 0.95;
    } catch {
      return 0.95;
    }
  });

  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [currentElement, setCurrentElement] = useState<HTMLElement | null>(null);

  // Tracking last tapped element for safe two-tap confirmation model
  const lastTappedElementRef = useRef<HTMLElement | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const focusClearTimeoutRef = useRef<any>(null);

  const setSpeechRate = (rate: number) => {
    const clamped = Math.max(0.7, Math.min(1.5, rate));
    setSpeechRateState(clamped);
    try {
      localStorage.setItem(RATE_KEY, clamped.toString());
    } catch {}
  };

  const stop = useCallback(() => {
    readAloudService.stop();
    setIsSpeaking(false);
    setIsPaused(false);
    setCurrentText('');
    if (currentElement) {
      currentElement.classList.remove('read-aloud-highlight-active');
    }
    setCurrentElement(null);
    lastTappedElementRef.current = null;
    if (focusClearTimeoutRef.current) {
      clearTimeout(focusClearTimeoutRef.current);
    }
  }, [currentElement]);

  const pause = useCallback(() => {
    readAloudService.pause();
    setIsPaused(true);
    setIsSpeaking(false);
  }, []);

  const resume = useCallback(() => {
    readAloudService.resume();
    setIsPaused(false);
    setIsSpeaking(true);
  }, []);

  const speak = useCallback(
    (text: string, element?: HTMLElement) => {
      if (!text || !text.trim()) return;

      // Stop previous speech cleanly
      readAloudService.stop();

      // Manage visual highlight
      if (currentElement && currentElement !== element) {
        currentElement.classList.remove('read-aloud-highlight-active');
      }

      if (element) {
        element.classList.add('read-aloud-highlight-active');
        setCurrentElement(element);
      }

      setCurrentText(text);
      setIsSpeaking(true);
      setIsPaused(false);

      readAloudService.speak(text, {
        lang: language,
        rate: speechRate,
        onStart: () => {
          setIsSpeaking(true);
          setIsPaused(false);
        },
        onEnd: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          if (element) {
            element.classList.remove('read-aloud-highlight-active');
          }
        },
        onError: () => {
          setIsSpeaking(false);
          setIsPaused(false);
          if (element) {
            element.classList.remove('read-aloud-highlight-active');
          }
        },
      });
    },
    [language, speechRate, currentElement]
  );

  const toggleReadAloud = useCallback(
    (forced?: boolean) => {
      const next = forced !== undefined ? forced : !isEnabled;
      setIsEnabled(next);
      try {
        localStorage.setItem(STORAGE_KEY, next ? 'true' : 'false');
      } catch {}

      if (!next) {
        stop();
      } else {
        // Welcome announcement in selected language
        const welcomeKey = 'readAloud.enabledAnnouncement';
        const fallback = 'Read Aloud Mode is now active. Tap any element to hear it spoken. Tap again to activate.';
        const announced = t(welcomeKey, undefined, fallback);
        speak(announced);
      }
    },
    [isEnabled, speak, stop, t]
  );

  const testVoice = useCallback(() => {
    const testSampleKey = 'readAloud.testSample';
    const fallback = 'AgriGuard voice synthesis is active in your chosen language.';
    const sample = t(testSampleKey, undefined, fallback);
    speak(sample);
  }, [speak, t]);

  /**
   * Helper to extract best accessible speech text from any DOM element
   */
  const extractSpeechContent = useCallback(
    (el: HTMLElement): string => {
      // 1. Explicit data attribute for customized Read Aloud text
      const dataText = el.getAttribute('data-read-aloud-text');
      if (dataText) return dataText;

      // 2. Stat card sentence formatting
      const statLabelKey = el.getAttribute('data-stat-label');
      const statVal = el.getAttribute('data-stat-value');
      if (statLabelKey !== null && statVal !== null) {
        const rawLabel = el.getAttribute('data-stat-raw-label') || el.innerText || statLabelKey;
        return formatStatSentence(statLabelKey, rawLabel, statVal, language);
      }

      // 3. Accessibility label
      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel && ariaLabel.trim()) return ariaLabel;

      // 4. Image alt text
      if (el.tagName === 'IMG') {
        const alt = (el as HTMLImageElement).alt;
        if (alt && alt.trim()) return alt;
        return t('accessibility.image', undefined, 'Image illustration');
      }

      // 5. Input fields
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') {
        const input = el as HTMLInputElement;
        const placeholder = input.placeholder ? `${input.placeholder}. ` : '';
        const value = input.type === 'password' ? 'Password protected' : input.value;
        const typeLabel = input.type ? `${input.type} field` : 'Input field';
        return `${placeholder}${value ? `Current value: ${value}` : typeLabel}`;
      }

      // 6. Direct readable text content
      const inner = el.innerText || el.textContent || '';
      return inner.trim();
    },
    [language, t]
  );

  /**
   * App-Wide Consistent Interaction Model (Capture Phase)
   * 1st Tap: Highlights element & speaks its content aloud.
   * 2nd Tap (on same element within 3.5s): Confirms and executes normal action!
   */
  useEffect(() => {
    if (!isEnabled) {
      // Remove any lingering highlight
      if (currentElement) {
        currentElement.classList.remove('read-aloud-highlight-active');
      }
      return;
    }

    const handleGlobalClickCapture = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      // A) Allow Read Aloud controls themselves to function directly without interception
      if (target.closest('[data-read-aloud-control]') || target.closest('[data-read-aloud-toggle]')) {
        return;
      }

      // B) Identify the meaningful target container
      const candidate = (target.closest(
        'button, a, input, select, textarea, [role="button"], [data-read-aloud], [data-stat-label], .glass-card, [role="tab"], [role="menuitem"], [role="switch"], [role="option"], summary, li, tr, img, h1, h2, h3, p'
      ) || target) as HTMLElement;

      if (!candidate) return;

      const now = Date.now();
      const isSameElement = lastTappedElementRef.current === candidate;
      const withinWindow = now - lastTapTimeRef.current < 3500;

      // C) Second Tap on the SAME element within 3.5s:
      // Allow execution! Let event bubble and trigger normal button / form submit / link click!
      if (isSameElement && withinWindow) {
        lastTappedElementRef.current = null;
        lastTapTimeRef.current = 0;
        candidate.classList.remove('read-aloud-highlight-active');
        if (focusClearTimeoutRef.current) {
          clearTimeout(focusClearTimeoutRef.current);
        }
        // Do not call preventDefault or stopPropagation — permit normal click!
        return;
      }

      // D) First Tap on a new element:
      // Prevent accidental triggering of action, highlight element, and speak aloud!
      event.preventDefault();
      event.stopPropagation();

      // Clear previous timer and highlights
      if (focusClearTimeoutRef.current) {
        clearTimeout(focusClearTimeoutRef.current);
      }
      if (lastTappedElementRef.current && lastTappedElementRef.current !== candidate) {
        lastTappedElementRef.current.classList.remove('read-aloud-highlight-active');
      }

      const textToSpeak = extractSpeechContent(candidate);
      if (textToSpeak) {
        speak(textToSpeak, candidate);
      }

      lastTappedElementRef.current = candidate;
      lastTapTimeRef.current = now;

      // Reset confirmation window after 3.5 seconds
      focusClearTimeoutRef.current = setTimeout(() => {
        if (lastTappedElementRef.current === candidate) {
          candidate.classList.remove('read-aloud-highlight-active');
          lastTappedElementRef.current = null;
        }
      }, 3500);
    };

    document.addEventListener('click', handleGlobalClickCapture, true);

    return () => {
      document.removeEventListener('click', handleGlobalClickCapture, true);
      if (focusClearTimeoutRef.current) {
        clearTimeout(focusClearTimeoutRef.current);
      }
    };
  }, [isEnabled, speak, extractSpeechContent, currentElement]);

  // Clean up on unmount or screen navigation
  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return (
    <ReadAloudContext.Provider
      value={{
        isEnabled,
        isSpeaking,
        isPaused,
        currentText,
        currentElement,
        speechRate,
        toggleReadAloud,
        speak,
        pause,
        resume,
        stop,
        setSpeechRate,
        testVoice,
      }}
    >
      {children}
    </ReadAloudContext.Provider>
  );
};

export const useReadAloud = (): ReadAloudContextType => {
  const context = useContext(ReadAloudContext);
  if (!context) {
    throw new Error('useReadAloud must be used within a ReadAloudProvider');
  }
  return context;
};
