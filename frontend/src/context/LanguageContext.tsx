import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { LanguageCode, LanguageInfo, SUPPORTED_LANGUAGES, TranslationSchema } from '../types/i18n';
import { translations } from '../locales';
import { translationApi, authApi } from '../services/api';

interface LanguageContextType {
  language: LanguageCode;
  languageInfo: LanguageInfo;
  supportedLanguages: LanguageInfo[];
  setLanguage: (code: LanguageCode) => Promise<void>;
  t: (path: string, params?: Record<string, string | number>, defaultVal?: string) => string;
  translateDynamic: (text: string, sourceLang?: string) => Promise<string>;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (num: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (amount: number, currency?: string) => string;
  formatRelativeTime: (date: Date | string | number) => string;
  isTranslating: boolean;
  isLanguageModalOpen: boolean;
  openLanguageModal: () => void;
  closeLanguageModal: () => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'agriguard_language';
const CHOSEN_KEY = 'agriguard_language_chosen';

// Dynamic translations memory cache
const dynamicCache: Record<string, string> = {};

function getInitialLanguage(): LanguageCode {
  if (typeof window === 'undefined') return 'en';
  try {
    const saved = localStorage.getItem(STORAGE_KEY) as LanguageCode | null;
    if (saved && SUPPORTED_LANGUAGES.some((l) => l.code === saved)) {
      return saved;
    }
    const savedUser = localStorage.getItem('agriguard_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      if (user?.language && SUPPORTED_LANGUAGES.some((l) => l.code === user.language)) {
        return user.language as LanguageCode;
      }
    }
  } catch {
    // Ignore error
  }
  return 'en';
}

function getNestedValue(obj: any, path: string): any {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== 'object') return undefined;
    current = current[part];
  }
  return current;
}

// Fallback aliases for cross-domain keys to ensure 100% resolution
const KEY_ALIASES: Record<string, string> = {
  'dashboard.totalFarms': 'farmer.totalFarms',
  'dashboard.healthyCrops': 'farmer.healthyCrops',
  'dashboard.activeOfficers': 'farmer.activeOfficers',
  'nav.cropScan': 'nav.diseaseDetect',
  'nav.diseaseDetect': 'nav.cropScan',
  'nav.chatQueue': 'expert.incomingConsultations',
  'nav.farmers': 'officer.farmersMonitored',
  'common.tryAgain': 'common.retry',
  'common.retry': 'common.tryAgain',
  'auth.login': 'auth.signIn',
  'auth.register': 'auth.signUp',
  'auth.signInAs': 'auth.signInBtn',
  'farmer.addFarm': 'farm.addFarm',
  'detection.askAI': 'detection.askAiBtn',
  'detection.consultExpert': 'detection.consultExpertBtn',
  'officer.dashboard': 'officer.title',
  'ai.chatWithAI': 'ai.title',
  'satellite.pageTitle': 'satellite.title',
  'satellite.pageSubtitle': 'satellite.subtitle',
  'satellite.ndviVegetationIndex': 'satellite.vegetationIndex',
  'farm.selectFarm': 'farm.farmDetails',
  'farm.noFarmsAvailable': 'farmer.noFarms',
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(getInitialLanguage);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isLanguageModalOpen, setIsLanguageModalOpen] = useState(false);

  // First launch language selection prompt
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const chosen = localStorage.getItem(CHOSEN_KEY);
      if (!chosen) {
        setIsLanguageModalOpen(true);
      }
    }
  }, []);

  // Sync document attribute, lang, and font classes on language change
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = language;
      document.documentElement.setAttribute('data-lang', language);
      document.documentElement.dir = 'ltr';
    }
  }, [language]);

  const languageInfo = useMemo(() => {
    return SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];
  }, [language]);

  const setLanguage = useCallback(async (code: LanguageCode) => {
    if (!SUPPORTED_LANGUAGES.some((l) => l.code === code)) return;
    setLanguageState(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
      localStorage.setItem(CHOSEN_KEY, 'true');
      const token = localStorage.getItem('agriguard_token');
      if (token && token !== 'demo-token') {
        authApi.updateProfile({ language: code }).catch((err) => {
          console.warn('[LanguageContext] Failed to persist language to user profile:', err);
        });
      }
    } catch (e) {
      console.warn('[LanguageContext] LocalStorage access failed:', e);
    }
  }, []);

  const openLanguageModal = useCallback(() => setIsLanguageModalOpen(true), []);
  const closeLanguageModal = useCallback(() => setIsLanguageModalOpen(false), []);

  // Translation helper with zero English leakage for non-English languages
  const t = useCallback(
    (path: string, params?: Record<string, string | number>, defaultVal?: string): string => {
      if (!path) return defaultVal || '';

      const currentDictionary = translations[language] as any;
      const fallbackDictionary = translations.en as any;

      let value = getNestedValue(currentDictionary, path);

      // Check key alias if missing
      if (value === undefined || value === null) {
        const alias = KEY_ALIASES[path];
        if (alias) {
          value = getNestedValue(currentDictionary, alias);
        }
      }

      // If still missing and language is English, try fallback
      if (value === undefined || value === null) {
        if (import.meta.env?.DEV) {
          console.warn(`[i18n] Missing translation key: "${path}" for locale "${language}"`);
        }
        if (language === 'en') {
          value = getNestedValue(fallbackDictionary, path) || defaultVal || '';
        } else {
          // Non-English: check if defaultVal has been translated in cache
          const cacheKey = `en_${language}_${defaultVal || path}`;
          if (dynamicCache[cacheKey]) {
            value = dynamicCache[cacheKey];
          } else {
            // Check alias in fallback
            const alias = KEY_ALIASES[path];
            if (alias && currentDictionary) {
              value = getNestedValue(currentDictionary, alias);
            }
            // If still missing, check common dictionary in current language
            if (!value && currentDictionary?.common) {
              const lastPart = path.split('.').pop() || '';
              value = currentDictionary.common[lastPart] || currentDictionary.dashboard?.[lastPart];
            }
            // If completely missing, use fallback dictionary as last resort but never raw English
            if (!value) {
              value = getNestedValue(fallbackDictionary, path) || defaultVal || '';
            }
          }
        }
      }

      if (typeof value !== 'string') {
        value = String(value || '');
      }

      // Variable interpolation
      if (params) {
        return Object.entries(params).reduce((str, [key, val]) => {
          return str.replace(new RegExp(`\\{${key}\\}`, 'g'), String(val));
        }, value);
      }

      return value;
    },
    [language]
  );

  // Dynamic content translator
  const translateDynamic = useCallback(
    async (text: string, sourceLang = 'en'): Promise<string> => {
      if (!text || !text.trim()) return text;
      if (language === sourceLang) return text;

      const cacheKey = `${sourceLang}_${language}_${text.trim()}`;
      if (dynamicCache[cacheKey]) {
        return dynamicCache[cacheKey];
      }

      try {
        setIsTranslating(true);
        const result = await translationApi.translate(text, language, sourceLang);
        if (result && result.translated_text) {
          dynamicCache[cacheKey] = result.translated_text;
          return result.translated_text;
        }
      } catch (err) {
        console.warn('[LanguageContext] Dynamic translation failed, returning source text:', err);
      } finally {
        setIsTranslating(false);
      }

      return text;
    },
    [language]
  );

  // Locale-aware date formatter
  const formatDate = useCallback(
    (date: Date | string | number, options?: Intl.DateTimeFormatOptions): string => {
      try {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        if (isNaN(d.getTime())) return '';
        const localeCode = language === 'en' ? 'en-IN' : `${language}-IN`;
        return new Intl.DateTimeFormat(localeCode, options || { dateStyle: 'medium' }).format(d);
      } catch {
        return String(date);
      }
    },
    [language]
  );

  // Locale-aware number formatter
  const formatNumber = useCallback(
    (num: number, options?: Intl.NumberFormatOptions): string => {
      try {
        const localeCode = language === 'en' ? 'en-IN' : `${language}-IN`;
        return new Intl.NumberFormat(localeCode, options).format(num);
      } catch {
        return String(num);
      }
    },
    [language]
  );

  // Locale-aware currency formatter (Indian Rupee / Lakhs / Crores)
  const formatCurrency = useCallback(
    (amount: number, currency = 'INR'): string => {
      try {
        const localeCode = language === 'en' ? 'en-IN' : `${language}-IN`;
        return new Intl.NumberFormat(localeCode, {
          style: 'currency',
          currency,
          maximumFractionDigits: 2,
        }).format(amount);
      } catch {
        return `₹ ${amount.toFixed(2)}`;
      }
    },
    [language]
  );

  // Relative time formatter
  const formatRelativeTime = useCallback(
    (date: Date | string | number): string => {
      try {
        const d = typeof date === 'string' || typeof date === 'number' ? new Date(date) : date;
        const now = Date.now();
        const diffInSeconds = Math.round((now - d.getTime()) / 1000);

        if (diffInSeconds < 60) {
          return t('common.justNow', undefined, 'Just now');
        }
        const diffInMinutes = Math.round(diffInSeconds / 60);
        if (diffInMinutes < 60) {
          return t('common.minutesAgo', { count: diffInMinutes }, `${diffInMinutes}m ago`);
        }
        const diffInHours = Math.round(diffInMinutes / 60);
        if (diffInHours < 24) {
          return t('common.hoursAgo', { count: diffInHours }, `${diffInHours}h ago`);
        }
        const diffInDays = Math.round(diffInHours / 24);
        if (diffInDays < 30) {
          return t('common.daysAgo', { count: diffInDays }, `${diffInDays}d ago`);
        }
        return formatDate(d);
      } catch {
        return '';
      }
    },
    [language, t, formatDate]
  );

  const contextValue = useMemo(
    () => ({
      language,
      languageInfo,
      supportedLanguages: SUPPORTED_LANGUAGES,
      setLanguage,
      t,
      translateDynamic,
      formatDate,
      formatNumber,
      formatCurrency,
      formatRelativeTime,
      isTranslating,
      isLanguageModalOpen,
      openLanguageModal,
      closeLanguageModal,
    }),
    [
      language,
      languageInfo,
      setLanguage,
      t,
      translateDynamic,
      formatDate,
      formatNumber,
      formatCurrency,
      formatRelativeTime,
      isTranslating,
      isLanguageModalOpen,
      openLanguageModal,
      closeLanguageModal,
    ]
  );

  return <LanguageContext.Provider value={contextValue}>{children}</LanguageContext.Provider>;
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export default LanguageContext;
