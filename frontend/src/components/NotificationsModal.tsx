import React, { useEffect, useState } from 'react';
import { X, Bell, CheckCheck, AlertTriangle, MessageSquare, Calendar, Shield, CloudRain } from 'lucide-react';
import { notificationsApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import type { NotificationItem } from '../types';

interface NotificationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (screen: string, recordId?: string) => void;
}

export const NotificationsModal: React.FC<NotificationsModalProps> = ({ isOpen, onClose, onNavigate }) => {
  const { t, formatRelativeTime } = useLanguage();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (isOpen) loadNotifications();
  }, [isOpen]);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.getNotifications();
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch { } finally {
      setLoading(false);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch { }
  };

  const handleNotificationClick = async (n: NotificationItem) => {
    if (!n.is_read) {
      try {
        await notificationsApi.markRead(n.id);
        setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, is_read: true } : item));
        setUnreadCount(prev => Math.max(0, prev - 1));
      } catch { }
    }

    let targetScreen = 'home';
    if (n.type === 'disease_alert') {
      targetScreen = 'disease-detect';
    } else if (n.type === 'expert_message' || n.type === 'officer_message') {
      targetScreen = 'chat';
    } else if (n.type === 'weather_alert') {
      targetScreen = 'satellite';
    } else if (n.type === 'field_visit' || n.type === 'case_update') {
      targetScreen = 'home';
    }

    onClose();
    if (onNavigate) {
      onNavigate(targetScreen, n.related_entity_id);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'disease_alert': return <AlertTriangle className="w-4 h-4 text-red-400" />;
      case 'weather_alert': return <CloudRain className="w-4 h-4 text-amber-400" />;
      case 'expert_message': case 'officer_message': return <MessageSquare className="w-4 h-4 text-cyan-400" />;
      case 'field_visit': return <Calendar className="w-4 h-4 text-amber-400" />;
      case 'case_update': return <Shield className="w-4 h-4 text-violet-400" />;
      default: return <Bell className="w-4 h-4 text-emerald-400" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end p-4" onClick={onClose}>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="glass-panel w-full max-w-sm p-4 space-y-3 relative mt-12 mr-2 animate-fade-in-up max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Bell className="w-4 h-4 text-emerald-400" />
            {t('notifications.title', undefined, 'Notifications')}
            {unreadCount > 0 && (
              <span className="badge-high text-[9px] px-1.5">{unreadCount}</span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="text-xs text-emerald-400 font-semibold hover:text-emerald-300 flex items-center gap-1">
                <CheckCheck className="w-3.5 h-3.5" /> {t('notifications.readAll', undefined, 'Read All')}
              </button>
            )}
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-emerald-900/30 transition">
              <X className="w-4 h-4 text-emerald-300" />
            </button>
          </div>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map(i => <div key={i} className="h-14 skeleton" />)}
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-center text-emerald-300/40 text-xs py-8">{t('notifications.empty', undefined, 'No notifications yet.')}</p>
        ) : (
          <div className="space-y-1">
            {notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                className={`flex items-start gap-3 p-3 rounded-xl transition cursor-pointer ${!n.is_read
                    ? 'bg-emerald-900/25 border border-emerald-500/25 hover:bg-emerald-900/40'
                    : 'hover:bg-emerald-900/15'
                  }`}
              >
                <div className="mt-0.5 flex-shrink-0">{getIcon(n.type)}</div>
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-semibold ${!n.is_read ? 'text-white' : 'text-emerald-200/70'} truncate`}>{n.title}</p>
                  <p className="text-[10px] text-emerald-300/50 mt-0.5 line-clamp-2">{n.message}</p>
                  <p className="text-[9px] text-emerald-300/30 mt-1">{formatRelativeTime(n.created_at)}</p>
                </div>
                {!n.is_read && <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

function formatTimeAgo(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  } catch { return ''; }
}
