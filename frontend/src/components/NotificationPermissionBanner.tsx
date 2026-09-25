import React, { useState, useEffect } from 'react';
import { Bell, X, ShieldCheck, Sparkles, Loader2 } from 'lucide-react';
import { pushService } from '../services/pushNotificationService';
import { useLanguage } from '../context/LanguageContext';

export const NotificationPermissionBanner: React.FC = () => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [subscribing, setSubscribing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    // Only show if push is supported and permission hasn't been decided yet
    if (pushService.isPushSupported()) {
      const permission = pushService.getPermissionStatus();
      const dismissed = localStorage.getItem('agriguard_push_prompt_dismissed');
      const alreadySubscribed = localStorage.getItem('agriguard_push_subscribed');

      if (permission === 'default' && !dismissed && !alreadySubscribed) {
        // Delay display slightly after login so user isn't startled
        const timer = setTimeout(() => {
          setVisible(true);
        }, 1800);
        return () => clearTimeout(timer);
      }
    }
  }, []);

  const handleEnable = async () => {
    setSubscribing(true);
    setStatusMessage(null);
    try {
      const result = await pushService.requestPermissionAndSubscribe();
      if (result.success) {
        setStatusMessage('Push notifications enabled for this device!');
        setTimeout(() => {
          setVisible(false);
        }, 2000);
      } else {
        setStatusMessage(result.error || 'Permission was not granted.');
        setTimeout(() => {
          setVisible(false);
        }, 3000);
      }
    } catch (e: any) {
      setStatusMessage('Failed to enable push alerts.');
      setTimeout(() => {
        setVisible(false);
      }, 3000);
    } finally {
      setSubscribing(false);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    localStorage.setItem('agriguard_push_prompt_dismissed', 'true');
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:w-96 z-50 animate-fade-in-up">
      <div className="glass-card p-4 border border-emerald-500/30 shadow-[0_10px_30px_rgba(0,0,0,0.5)] bg-emerald-950/90 backdrop-blur-md rounded-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute -top-12 -right-12 w-24 h-24 bg-emerald-500/20 rounded-full blur-xl pointer-events-none" />

        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center flex-shrink-0 text-emerald-400 mt-0.5">
            <Bell className="w-5 h-5 animate-pulse" />
          </div>

          <div className="flex-1 min-w-0 pr-4">
            <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
              <span>{t('notifications.enableTitle', undefined, 'Enable Real-Time Alerts')}</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </h4>
            <p className="text-[11px] text-emerald-200/80 mt-1 leading-relaxed">
              {t(
                'notifications.enableDescription',
                undefined,
                'Get instant notifications on your phone when disease scans finish, officers schedule visits, or experts reply.'
              )}
            </p>

            {statusMessage && (
              <p className="text-[11px] font-semibold text-emerald-300 mt-1.5 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" />
                {statusMessage}
              </p>
            )}

            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={handleEnable}
                disabled={subscribing}
                className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {subscribing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Enabling...</span>
                  </>
                ) : (
                  <>
                    <Bell className="w-3.5 h-3.5" />
                    <span>{t('notifications.allowBtn', undefined, 'Allow Alerts')}</span>
                  </>
                )}
              </button>

              <button
                onClick={handleDismiss}
                className="px-2.5 py-1.5 text-xs font-semibold text-emerald-300/70 hover:text-white transition cursor-pointer"
              >
                {t('common.later', undefined, 'Later')}
              </button>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-lg text-emerald-400/60 hover:text-white hover:bg-emerald-800/30 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
