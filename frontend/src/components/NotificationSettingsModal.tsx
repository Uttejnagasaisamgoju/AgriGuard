import React, { useState, useEffect } from 'react';
import {
  X, Bell, BellOff, ShieldAlert, Sparkles, Send, CheckCircle2,
  AlertTriangle, RefreshCw, Smartphone, Volume2, Vibrate, ChevronDown, ChevronUp
} from 'lucide-react';
import { pushService } from '../services/pushNotificationService';
import type { NotificationPreferences, PushDeliveryLogItem } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface NotificationSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationSettingsModal: React.FC<NotificationSettingsModalProps> = ({ isOpen, onClose }) => {
  const { t, formatRelativeTime } = useLanguage();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testSending, setTestSending] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);

  const [preferences, setPreferences] = useState<NotificationPreferences>({
    push_enabled: true,
    disease_alerts: true,
    expert_messages: true,
    officer_updates: true,
    weather_alerts: true,
    system_updates: true,
    sound_enabled: true,
    vibration_enabled: true,
  });

  const [deliveryLogs, setDeliveryLogs] = useState<PushDeliveryLogItem[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadState();
    }
  }, [isOpen]);

  const loadState = async () => {
    setLoading(true);
    setTestResult(null);
    try {
      const supported = pushService.isPushSupported();
      setIsSupported(supported);
      setPermission(pushService.getPermissionStatus());

      const sub = await pushService.getExistingSubscription();
      setIsSubscribed(!!sub);

      const prefs = await pushService.getPreferences();
      setPreferences(prefs);

      const logs = await pushService.getDeliveryLogs();
      setDeliveryLogs(logs);
    } catch (err) {
      console.error('Failed to load notification settings:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDevicePush = async () => {
    setSaving(true);
    try {
      if (isSubscribed) {
        await pushService.unsubscribe();
        setIsSubscribed(false);
        setPermission(pushService.getPermissionStatus());
        setTestResult('Device notifications unsubscribed.');
      } else {
        const res = await pushService.requestPermissionAndSubscribe();
        setPermission(res.permission);
        if (res.success) {
          setIsSubscribed(true);
          setTestResult('Device subscribed to push notifications successfully!');
        } else {
          setTestResult(res.error || 'Could not subscribe device.');
        }
      }
    } catch (e: any) {
      setTestResult(e?.message || 'Error updating device push.');
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePreference = async (key: keyof NotificationPreferences) => {
    const nextVal = !preferences[key];
    const updated = { ...preferences, [key]: nextVal };
    setPreferences(updated);

    try {
      await pushService.updatePreferences({ [key]: nextVal });
    } catch (err) {
      console.error('Failed to update preference:', err);
      // revert on failure
      setPreferences(preferences);
    }
  };

  const handleSendTestPush = async () => {
    setTestSending(true);
    setTestResult(null);
    try {
      const res = await pushService.sendTestPush();
      if (res.status === 'completed' && res.delivered > 0) {
        setTestResult('Test push sent! Check your notification shade/lock screen.');
      } else if (res.status === 'no_subscriptions') {
        setTestResult('No active device subscribed. Enable push alerts above first.');
      } else if (res.status === 'skipped') {
        setTestResult('Push notifications are currently disabled in your preferences.');
      } else {
        setTestResult('Test notification dispatched.');
      }
      // Reload delivery logs
      const logs = await pushService.getDeliveryLogs();
      setDeliveryLogs(logs);
    } catch (e: any) {
      setTestResult(e?.response?.data?.detail || 'Failed to send test push.');
    } finally {
      setTestSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        className="glass-card w-full max-w-lg p-6 space-y-5 border border-emerald-500/30 bg-emerald-950/95 max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400">
              <Bell className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">
                {t('settings.notificationPreferences', undefined, 'Push Notification Settings')}
              </h3>
              <p className="text-[11px] text-emerald-300/60">
                Manage real device alerts & deep-linking preferences
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-emerald-900/30 text-emerald-300 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-6 h-6 text-emerald-400 animate-spin" />
            <p className="text-xs text-emerald-300/70">Loading notification configuration...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Device Subscription Card */}
            <div className="p-4 rounded-2xl bg-emerald-900/30 border border-emerald-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Smartphone className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold text-white">This Device Status</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                    isSubscribed && permission === 'granted'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : permission === 'denied'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {isSubscribed && permission === 'granted'
                    ? 'Subscribed'
                    : permission === 'denied'
                    ? 'Permission Denied'
                    : 'Not Subscribed'}
                </span>
              </div>

              <p className="text-[11px] text-emerald-200/70 leading-relaxed">
                {isSubscribed
                  ? 'Your device is actively registered to receive real push alerts for crop scans, chats, and field visits.'
                  : 'Enable Web Push to receive instant background notifications even when AgriGuard is closed.'}
              </p>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleToggleDevicePush}
                  disabled={saving || !isSupported}
                  className={`py-2 px-3.5 text-xs font-bold rounded-xl flex items-center gap-2 cursor-pointer transition ${
                    isSubscribed
                      ? 'bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/30'
                      : 'btn-primary'
                  }`}
                >
                  {saving ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : isSubscribed ? (
                    <BellOff className="w-3.5 h-3.5" />
                  ) : (
                    <Bell className="w-3.5 h-3.5" />
                  )}
                  <span>{isSubscribed ? 'Unsubscribe Device' : 'Enable Device Push Alerts'}</span>
                </button>

                {isSubscribed && (
                  <button
                    onClick={handleSendTestPush}
                    disabled={testSending}
                    className="btn-secondary py-2 px-3 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{testSending ? 'Sending...' : 'Send Test Push'}</span>
                  </button>
                )}
              </div>

              {testResult && (
                <div className="p-2.5 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-[11px] text-emerald-200 flex items-center gap-2 animate-fade-in">
                  <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <span>{testResult}</span>
                </div>
              )}
            </div>

            {/* Notification Category Controls */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
                <span>Notification Categories</span>
                <span className="text-[10px] text-emerald-400/60 font-normal">Active Backend Filtering</span>
              </h4>

              <div className="divide-y divide-white/5 rounded-2xl bg-emerald-900/15 border border-emerald-500/15 overflow-hidden">
                {/* Global Push Master Switch */}
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Master Push Notification Switch</p>
                    <p className="text-[10px] text-emerald-300/50">Allow AgriGuard to dispatch push notifications to you</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.push_enabled}
                    onChange={() => handleTogglePreference('push_enabled')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
                  />
                </div>

                {/* Disease Detection Alerts */}
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Disease Detection & Scan Results</p>
                    <p className="text-[10px] text-emerald-300/50">Instant alerts when AI analysis finishes or outbreaks occur</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.disease_alerts}
                    disabled={!preferences.push_enabled}
                    onChange={() => handleTogglePreference('disease_alerts')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:opacity-30"
                  />
                </div>

                {/* Expert & Officer Messages */}
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Expert & Officer Chat Messages</p>
                    <p className="text-[10px] text-emerald-300/50">Replies from plant pathologists and extension officers</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.expert_messages}
                    disabled={!preferences.push_enabled}
                    onChange={() => handleTogglePreference('expert_messages')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:opacity-30"
                  />
                </div>

                {/* Field Visits & Case Updates */}
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Field Inspection Visits & Case Updates</p>
                    <p className="text-[10px] text-emerald-300/50">Confirmed officer visit dates and resolution milestones</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.officer_updates}
                    disabled={!preferences.push_enabled}
                    onChange={() => handleTogglePreference('officer_updates')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:opacity-30"
                  />
                </div>

                {/* Weather & Agronomic Alerts */}
                <div className="p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-white">Weather Risk & Pest Warnings</p>
                    <p className="text-[10px] text-emerald-300/50">High humidity fungal blast and heat stress advisories</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={preferences.weather_alerts}
                    disabled={!preferences.push_enabled}
                    onChange={() => handleTogglePreference('weather_alerts')}
                    className="w-4 h-4 accent-emerald-500 rounded cursor-pointer disabled:opacity-30"
                  />
                </div>
              </div>
            </div>

            {/* Delivery Audit & Failure Logs (Reliability Verification) */}
            <div className="border-t border-white/10 pt-3">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="w-full flex items-center justify-between py-2 text-xs font-semibold text-emerald-300 hover:text-white transition cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  <span>Push Delivery Audit & Reliability Logs</span>
                  <span className="text-[10px] text-emerald-400/60 font-mono">({deliveryLogs.length})</span>
                </div>
                {showLogs ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>

              {showLogs && (
                <div className="mt-2 space-y-1.5 max-h-48 overflow-y-auto pr-1 animate-fade-in">
                  {deliveryLogs.length === 0 ? (
                    <p className="text-[11px] text-emerald-300/40 text-center py-4">No push delivery events logged yet.</p>
                  ) : (
                    deliveryLogs.map((log) => (
                      <div
                        key={log.id}
                        className="p-2.5 rounded-xl bg-black/30 border border-white/5 flex items-start justify-between gap-2 text-[11px]"
                      >
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">{log.title}</p>
                          <p className="text-[10px] text-emerald-300/50">
                            {log.notification_type || 'system'} • {formatRelativeTime(log.created_at || '')}
                          </p>
                          {log.error_message && (
                            <p className="text-[10px] text-red-300/80 mt-0.5">{log.error_message}</p>
                          )}
                        </div>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase flex-shrink-0 ${
                            log.status === 'delivered'
                              ? 'bg-emerald-500/20 text-emerald-300'
                              : log.status === 'expired'
                              ? 'bg-amber-500/20 text-amber-300'
                              : 'bg-red-500/20 text-red-300'
                          }`}
                        >
                          {log.status} {log.status_code ? `(${log.status_code})` : ''}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end pt-2 border-t border-white/10">
          <button
            onClick={onClose}
            className="btn-primary py-2 px-5 text-xs font-bold cursor-pointer"
          >
            {t('common.done', undefined, 'Done')}
          </button>
        </div>
      </div>
    </div>
  );
};
