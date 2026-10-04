import React from 'react';
import { Volume2, VolumeX, Pause, Play, Square, X, Gauge } from 'lucide-react';
import { useReadAloud } from '../context/ReadAloudContext';
import { useLanguage } from '../context/LanguageContext';

export const ReadAloudControls: React.FC = () => {
  const {
    isEnabled,
    isSpeaking,
    isPaused,
    currentText,
    speechRate,
    setSpeechRate,
    pause,
    resume,
    stop,
    toggleReadAloud,
  } = useReadAloud();

  const { languageInfo, t } = useLanguage();

  if (!isEnabled) return null;

  const cycleRate = () => {
    if (speechRate === 0.95) setSpeechRate(1.15);
    else if (speechRate === 1.15) setSpeechRate(0.85);
    else setSpeechRate(0.95);
  };

  return (
    <aside
      data-read-aloud-control="true"
      aria-label={t('readAloud.floatingControls', undefined, 'Read Aloud voice mode controls')}
      className="fixed bottom-20 sm:bottom-6 right-3 sm:right-6 z-50 max-w-sm w-[calc(100%-1.5rem)] sm:w-auto animate-fade-in-up"
    >
      <div className="glass-card p-2.5 sm:p-3 border border-emerald-400/40 bg-emerald-950/90 backdrop-blur-2xl shadow-2xl rounded-2xl flex flex-col gap-2">
        {/* Top Row: Mode indicator, language badge, and close button */}
        <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <div className="relative w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
              <Volume2 className={`w-3.5 h-3.5 text-emerald-300 ${isSpeaking ? 'animate-pulse' : ''}`} />
              {isSpeaking && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              )}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-black text-white font-heading tracking-wide uppercase">
                  {t('readAloud.title', undefined, 'Read Aloud Mode')}
                </span>
                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 truncate max-w-[80px]">
                  {languageInfo.nativeName || languageInfo.name}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {/* Speed Rate Pill */}
            <button
              type="button"
              data-read-aloud-control="true"
              onClick={cycleRate}
              className="px-2 py-0.5 rounded-lg bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 text-[10px] font-bold border border-emerald-500/30 flex items-center gap-1 transition cursor-pointer"
              title={t('readAloud.changeSpeed', undefined, 'Toggle speech speed')}
              aria-label={`${speechRate}x speed. Click to change.`}
            >
              <Gauge className="w-2.5 h-2.5 text-emerald-400" />
              <span>{speechRate}x</span>
            </button>

            {/* Turn Off Button */}
            <button
              type="button"
              data-read-aloud-control="true"
              onClick={() => toggleReadAloud(false)}
              className="p-1 rounded-lg bg-red-950/40 hover:bg-red-900/60 text-red-300 border border-red-500/30 transition cursor-pointer"
              title={t('readAloud.turnOff', undefined, 'Turn off Read Aloud Mode')}
              aria-label={t('readAloud.turnOff', undefined, 'Turn off Read Aloud Mode')}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Middle Row: Active phrase snippet & soundwave bars */}
        {currentText && (
          <div className="px-1 py-0.5 flex items-center gap-2">
            <div className="flex items-center gap-0.5 shrink-0 h-3">
              <span className={`w-0.5 rounded bg-emerald-400 ${isSpeaking ? 'h-3 animate-pulse' : 'h-1'}`} />
              <span className={`w-0.5 rounded bg-emerald-400 ${isSpeaking ? 'h-2.5 animate-pulse' : 'h-1'}`} />
              <span className={`w-0.5 rounded bg-emerald-400 ${isSpeaking ? 'h-3.5 animate-pulse' : 'h-1'}`} />
              <span className={`w-0.5 rounded bg-emerald-400 ${isSpeaking ? 'h-2 animate-pulse' : 'h-1'}`} />
            </div>
            <p className="text-[11px] text-emerald-200/90 truncate italic font-medium">
              "{currentText}"
            </p>
          </div>
        )}

        {/* Bottom Row: Control Buttons (Pause/Resume, Stop) + Safe Interaction Micro-hint */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5">
            {/* Pause / Resume */}
            {isSpeaking ? (
              <button
                type="button"
                data-read-aloud-control="true"
                onClick={pause}
                className="py-1 px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-sm"
                title={t('readAloud.pause', undefined, 'Pause speech')}
                aria-label={t('readAloud.pause', undefined, 'Pause speech')}
              >
                <Pause className="w-3 h-3 text-emerald-300" />
                <span>{t('readAloud.pause', undefined, 'Pause')}</span>
              </button>
            ) : isPaused ? (
              <button
                type="button"
                data-read-aloud-control="true"
                onClick={resume}
                className="py-1 px-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-emerald-950 text-xs font-black flex items-center gap-1 transition cursor-pointer shadow-md"
                title={t('readAloud.resume', undefined, 'Resume speech')}
                aria-label={t('readAloud.resume', undefined, 'Resume speech')}
              >
                <Play className="w-3 h-3 fill-emerald-950 text-emerald-950" />
                <span>{t('readAloud.resume', undefined, 'Resume')}</span>
              </button>
            ) : null}

            {/* Stop */}
            {(isSpeaking || isPaused || currentText) && (
              <button
                type="button"
                data-read-aloud-control="true"
                onClick={stop}
                className="py-1 px-2.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 text-emerald-300 border border-emerald-500/30 text-xs font-bold flex items-center gap-1 transition cursor-pointer"
                title={t('readAloud.stop', undefined, 'Stop audio')}
                aria-label={t('readAloud.stop', undefined, 'Stop audio')}
              >
                <Square className="w-3 h-3" />
                <span>{t('readAloud.stop', undefined, 'Stop')}</span>
              </button>
            )}
          </div>

          {/* Micro-hint for safe interaction model */}
          <span className="text-[10px] text-emerald-400/70 font-semibold select-none hidden xs:inline">
            {t('readAloud.tapHint', undefined, 'Tap once to hear • Tap again to open')}
          </span>
        </div>
      </div>
    </aside>
  );
};
