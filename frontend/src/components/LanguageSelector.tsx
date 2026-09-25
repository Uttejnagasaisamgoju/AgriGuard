import React, { useState, useRef, useEffect } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LanguageCode } from '../types/i18n';

interface LanguageSelectorProps {
  variant?: 'dropdown' | 'buttons' | 'compact';
  direction?: 'up' | 'down';
  className?: string;
  onLanguageChange?: (lang: LanguageCode) => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'dropdown',
  direction = 'down',
  className = '',
  onLanguageChange,
}) => {
  const { language, setLanguage, supportedLanguages, languageInfo } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleSelect = async (code: LanguageCode) => {
    await setLanguage(code);
    setIsOpen(false);
    if (onLanguageChange) {
      onLanguageChange(code);
    }
  };

  // Variant: Buttons (Great for Settings view or full modal)
  if (variant === 'buttons') {
    return (
      <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2.5 ${className}`}>
        {supportedLanguages.map((lang) => {
          const isSelected = lang.code === language;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => handleSelect(lang.code)}
              className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                isSelected
                  ? 'bg-emerald-600/30 border-emerald-400 text-emerald-100 shadow-md shadow-emerald-950/40 ring-1 ring-emerald-400/50'
                  : 'bg-emerald-950/40 border-emerald-500/20 text-emerald-200/80 hover:bg-emerald-900/40 hover:text-white hover:border-emerald-500/40'
              }`}
            >
              <div>
                <p className="text-sm font-bold tracking-wide">{lang.nativeName}</p>
                <p className="text-[11px] text-emerald-400/70">{lang.name}</p>
              </div>
              {isSelected && (
                <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center text-emerald-950">
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    );
  }

  // Variant: Compact (Small badge for tight bars)
  if (variant === 'compact') {
    return (
      <div className={`relative inline-block ${className}`} ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-emerald-950/70 hover:bg-emerald-900/70 border border-emerald-500/30 hover:border-emerald-400/60 text-emerald-200 hover:text-white transition text-xs font-semibold shadow-sm cursor-pointer"
          aria-label="Select language"
        >
          <Globe className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
          <span className="font-bold">{languageInfo.nativeName}</span>
          <ChevronDown
            className={`w-3 h-3 text-emerald-400/80 transition-transform duration-200 ${
              isOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {isOpen && (
          <div
            className={`absolute right-0 ${
              direction === 'up' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
            } w-48 max-h-72 overflow-y-auto rounded-xl bg-emerald-950/95 border border-emerald-500/30 shadow-2xl backdrop-blur-xl py-1.5 z-50 animate-in fade-in zoom-in-95 duration-100 scrollbar-thin`}
          >
            {supportedLanguages.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition ${
                  lang.code === language
                    ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                    : 'text-emerald-200/80 hover:bg-emerald-900/50 hover:text-white'
                }`}
              >
                <span>{lang.nativeName} ({lang.name})</span>
                {lang.code === language && <Check className="w-3.5 h-3.5 text-emerald-400" />}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Variant: Dropdown (Default standard navbar selector)
  return (
    <div className={`relative inline-block text-left ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-emerald-900/50 hover:bg-emerald-800/60 border border-emerald-500/30 hover:border-emerald-400/60 text-emerald-100 transition shadow-sm cursor-pointer"
        aria-expanded={isOpen}
        aria-haspopup="true"
        title="Select Language / భాషను ఎంచుకోండి / भाषा निवडा"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Globe className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span className="text-xs sm:text-sm font-semibold tracking-wide truncate">
            {languageInfo.nativeName}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-emerald-400/80 transition-transform duration-200 flex-shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div
          className={`absolute left-0 right-0 ${
            direction === 'up' ? 'bottom-full mb-2' : 'top-full mt-2'
          } max-h-72 overflow-y-auto rounded-2xl bg-emerald-950/95 border border-emerald-500/30 shadow-2xl backdrop-blur-2xl py-1.5 z-50 ring-1 ring-black/20 animate-in fade-in slide-in-from-top-2 duration-150 scrollbar-thin`}
          role="menu"
        >
          <div className="px-3 py-1.5 border-b border-emerald-500/15 mb-1">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
              Select Language / భాష / भाषा
            </p>
          </div>
          {supportedLanguages.map((lang) => {
            const isSelected = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelect(lang.code)}
                className={`w-full flex items-center justify-between px-3.5 py-2 text-left transition ${
                  isSelected
                    ? 'bg-emerald-600/30 text-emerald-100 font-bold border-l-2 border-emerald-400'
                    : 'text-emerald-200/80 hover:bg-emerald-900/50 hover:text-white'
                }`}
                role="menuitem"
              >
                <div>
                  <p className="text-sm leading-tight">{lang.nativeName}</p>
                  <p className="text-[10px] text-emerald-400/70">{lang.name}</p>
                </div>
                {isSelected && (
                  <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 stroke-[2.5]" />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default LanguageSelector;
