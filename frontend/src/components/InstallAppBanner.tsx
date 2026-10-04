import React, { useState, useEffect } from 'react';
import { Smartphone, Download, X, Share, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallAppBannerProps {
  onOpenDownload?: () => void;
}

export const InstallAppBanner: React.FC<InstallAppBannerProps> = ({ onOpenDownload }) => {
  const { t } = useLanguage();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if already running in standalone PWA / native mode
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone ||
      document.referrer.includes('android-app://');

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed in this session
    if (sessionStorage.getItem('agriguard_pwa_dismissed') === 'true') {
      setDismissed(true);
    }

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIOSSafari = /iphone|ipad|ipod/.test(userAgent) && !/crios|fxios|opios/.test(userAgent);
    setIsIOS(isIOSSafari);

    // Capture Chrome/Android install prompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setIsInstalled(true);
      setInstallPrompt(null);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setInstallPrompt(null);
    } else if (isIOS) {
      setShowIOSInstructions(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('agriguard_pwa_dismissed', 'true');
  };

  // Do not render if installed, dismissed, or unsupported
  if (isInstalled || dismissed || (!installPrompt && !isIOS)) {
    return null;
  }

  return (
    <>
      <aside aria-label="Mobile app installation prompt" className="fixed top-2 left-2 right-2 z-50 max-w-md mx-auto animate-fade-in-up">
        <div className="glass-card p-3 border border-emerald-400/40 bg-emerald-950/90 shadow-2xl backdrop-blur-xl flex items-center justify-between gap-3">
          {/* App Icon */}
          <div className="w-10 h-10 rounded-xl overflow-hidden border border-emerald-500/40 shadow-md flex-shrink-0 bg-emerald-950 p-1">
            <img src="/icons/icon-192x192.png" alt="AgriGuard" className="w-full h-full object-contain" />
          </div>

          {/* Text Content */}
          <div
            onClick={onOpenDownload}
            className={`flex-1 min-w-0 text-left ${onOpenDownload ? 'cursor-pointer hover:opacity-90' : ''}`}
            title={t('download.fastInstall', undefined, 'Open installation options')}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-black text-white">{t('download.title', undefined, 'Install AgriGuard App')}</span>
              <span className="text-[9px] font-extrabold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PWA &amp; APK
              </span>
            </div>
            <p className="text-[11px] text-emerald-300/80 truncate">
              {t('download.features', undefined, 'Offline crop disease scans & field alerts')}
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={handleInstallClick}
              className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1 shadow-md cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-emerald-950" />
              <span>{t('common.download', undefined, 'Install')}</span>
            </button>
            <button
              onClick={handleDismiss}
              className="w-7 h-7 rounded-lg text-emerald-400/70 hover:text-white hover:bg-emerald-900/30 flex items-center justify-center transition cursor-pointer"
              title={t('common.close', undefined, 'Dismiss')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* iOS Add to Home Screen Instructions Modal */}
      {showIOSInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="glass-card p-5 max-w-sm w-full border border-emerald-500/40 space-y-4 text-left shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-emerald-500/20">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <Smartphone className="w-4 h-4 text-emerald-400" />
                <span>Install on iOS (iPhone / iPad)</span>
              </div>
              <button
                onClick={() => setShowIOSInstructions(false)}
                className="text-emerald-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-emerald-200/90 leading-relaxed">
              Install AgriGuard directly to your iPhone home screen for fullscreen offline field use:
            </p>

            <ol className="space-y-3 text-xs text-emerald-100/90 pl-1">
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  1
                </span>
                <span>
                  Tap the <strong className="text-white">Share</strong> button <Share className="w-3.5 h-3.5 inline mx-1 text-emerald-400" /> in Safari’s bottom toolbar.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  2
                </span>
                <span>
                  Scroll down the menu and tap <strong className="text-white">"Add to Home Screen"</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                  3
                </span>
                <span>
                  Tap <strong className="text-white">"Add"</strong> in the top right corner. AgriGuard will appear as a standalone app!
                </span>
              </li>
            </ol>

            <button
              onClick={() => setShowIOSInstructions(false)}
              className="btn-primary w-full py-2.5 text-xs font-bold cursor-pointer"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
