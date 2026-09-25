import React, { useState } from 'react';
import { Globe, Check, Sparkles, ArrowRight, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LanguageCode, SUPPORTED_LANGUAGES } from '../types/i18n';

interface FirstLaunchLanguageModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const FirstLaunchLanguageModal: React.FC<FirstLaunchLanguageModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { language, setLanguage, t } = useLanguage();
  const [selected, setSelected] = useState<LanguageCode>(language);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const handleSelectLanguage = (code: LanguageCode) => {
    setSelected(code);
  };

  const handleConfirm = async () => {
    setSaving(true);
    try {
      await setLanguage(selected);
      if (typeof window !== 'undefined') {
        localStorage.setItem('agriguard_language_chosen', 'true');
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 bg-emerald-950/85 backdrop-blur-2xl animate-fade-in select-none">
      <div className="glass-panel w-full max-w-xl p-5 sm:p-8 rounded-3xl border border-emerald-400/30 shadow-[0_25px_70px_rgba(0,0,0,0.85)] backdrop-blur-3xl relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Glow decorative spheres */}
        <div className="absolute -top-20 -right-20 w-48 h-48 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-48 h-48 bg-green-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="text-center mb-5 shrink-0 relative">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500/30 to-green-400/20 border border-emerald-400/50 flex items-center justify-center mx-auto mb-3 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
            <Globe className="w-7 h-7 text-emerald-300 stroke-[2.5]" />
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white font-heading tracking-tight leading-snug">
            {t('onboarding.selectLanguageTitle', undefined, 'Select Your Language')}
          </h2>
          <p className="text-xs sm:text-sm text-emerald-200/80 mt-1 font-medium">
            {t('onboarding.selectLanguageSubtitle', undefined, 'Experience AgriGuard completely in your native mother tongue')}
          </p>
          <div className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-emerald-400/90 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>{t('onboarding.firstLaunchGreeting', undefined, 'Namaste! Welcome to AgriGuard')}</span>
          </div>
        </div>

        {/* Language Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-2 gap-2.5 overflow-y-auto pr-1 py-1 flex-1 custom-scrollbar">
          {SUPPORTED_LANGUAGES.map((lang) => {
            const isSelected = selected === lang.code;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => handleSelectLanguage(lang.code)}
                className={`relative flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? 'bg-gradient-to-r from-emerald-600/35 to-green-600/25 border-emerald-400 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-400/50 scale-[1.02]'
                    : 'bg-emerald-950/40 border-emerald-500/20 text-emerald-100/90 hover:bg-emerald-900/40 hover:border-emerald-400/40'
                }`}
              >
                <div className="min-w-0 pr-2">
                  <p className="text-base sm:text-lg font-black tracking-wide leading-tight text-white font-heading">
                    {lang.native}
                  </p>
                  <p className="text-[11px] text-emerald-400/80 font-semibold mt-0.5 truncate">
                    {lang.name}
                  </p>
                  {lang.region && (
                    <p className="text-[10px] text-emerald-300/60 truncate mt-0.5">
                      {lang.region}
                    </p>
                  )}
                </div>

                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-emerald-400 text-emerald-950 shadow-md scale-110'
                      : 'border border-emerald-500/30 text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                </div>
              </button>
            );
          })}
        </div>

        {/* Modal Footer / Confirm Button */}
        <div className="mt-5 pt-4 border-t border-emerald-500/20 shrink-0 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-emerald-300/70 font-medium text-center sm:text-left">
            <span>{t('onboarding.currentLanguage', undefined, 'Current Language')}: </span>
            <strong className="text-emerald-300 font-bold">
              {SUPPORTED_LANGUAGES.find((l) => l.code === selected)?.native || 'English'}
            </strong>
          </div>

          <button
            type="button"
            onClick={handleConfirm}
            disabled={saving}
            className="btn-primary w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-xs tracking-wide flex items-center justify-center gap-2 shadow-[0_0_25px_rgba(16,185,129,0.45)] cursor-pointer"
          >
            {saving ? (
              <span className="inline-block w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <span>{t('onboarding.continueBtn', undefined, 'Continue')}</span>
                <ArrowRight className="w-4 h-4 stroke-[2.5]" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FirstLaunchLanguageModal;
