import React from 'react';
import {
  Leaf, Home, Satellite, Scan, BookOpen, MessageSquare,
  ShieldCheck, BarChart3, Settings, LogOut, Users, MapPin, Calendar,
  Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';

interface SidebarProps {
  currentScreen: string;
  onNavigate: (screen: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentScreen, onNavigate }) => {
  const { user, logout } = useAuth();
  const { tokens } = useTheme();
  const { t } = useLanguage();
  const role = (user?.role || 'FARMER').toUpperCase();

  let menuItems: Array<{ id: string; label: string; icon: any }> = [];

  if (role === 'OFFICER') {
    menuItems = [
      { id: 'home', label: t('nav.home', undefined, 'Home'), icon: Home },
      { id: 'farmers', label: t('nav.farmers', undefined, 'Farmers Monitored'), icon: Users },
      { id: 'ai-assistant', label: t('nav.aiAssistant', undefined, 'AI Assistant'), icon: Bot },
      { id: 'visits', label: t('nav.visits', undefined, 'Field Visits'), icon: MapPin },
      { id: 'reports', label: t('nav.reports', undefined, 'Reports'), icon: BarChart3 },
      { id: 'disease-library', label: t('nav.diseaseLibrary', undefined, 'Disease Library'), icon: BookOpen },
      { id: 'settings', label: t('nav.settings', undefined, 'Settings'), icon: Settings },
    ];
  } else if (role === 'EXPERT') {
    menuItems = [
      { id: 'home', label: t('nav.home', undefined, 'Home'), icon: Home },
      { id: 'chat', label: t('nav.chatQueue', undefined, 'Chat Queue'), icon: MessageSquare },
      { id: 'ai-assistant', label: t('nav.aiAssistant', undefined, 'AI Assistant'), icon: Bot },
      { id: 'disease-library', label: t('nav.diseaseLibrary', undefined, 'Disease Library'), icon: BookOpen },
      { id: 'reports', label: t('nav.reports', undefined, 'Reports'), icon: BarChart3 },
      { id: 'settings', label: t('nav.settings', undefined, 'Settings'), icon: Settings },
    ];
  } else {
    menuItems = [
      { id: 'home', label: t('nav.home', undefined, 'Home'), icon: Home },
      { id: 'ai-assistant', label: t('nav.aiAssistant', undefined, 'AI Assistant'), icon: Bot },
      { id: 'disease-detect', label: t('nav.diseaseDetect', undefined, 'Disease Detection'), icon: Scan },
      { id: 'satellite', label: t('nav.satellite', undefined, 'Satellite View'), icon: Satellite },
      { id: 'disease-library', label: t('nav.diseaseLibrary', undefined, 'Disease Library'), icon: BookOpen },
      { id: 'chat', label: t('nav.expertChat', undefined, 'Expert Chat'), icon: MessageSquare },
      { id: 'reports', label: t('nav.reports', undefined, 'Reports'), icon: BarChart3 },
      { id: 'settings', label: t('nav.settings', undefined, 'Settings'), icon: Settings },
    ];
  }

  const avatarSrc =
    role === 'EXPERT'
      ? '/expert_dr_ramesh.jpg'
      : role === 'OFFICER'
      ? 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150'
      : '/farmer_avatar.jpg';

  return (
    <aside className="w-full h-full bg-[#031c15]/92 backdrop-blur-xl border-r border-white/10 flex flex-col justify-between py-5 px-4 select-none overflow-y-auto">
      {/* Brand */}
      <div>
        <div className="flex items-center gap-2.5 px-3 py-3 mb-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              backgroundColor: tokens.soft,
              borderColor: tokens.border,
              borderWidth: '1px',
              borderStyle: 'solid',
              boxShadow: `0 0 15px ${tokens.glow}`,
            }}
          >
            <Leaf className="w-5 h-5 stroke-[2.5]" style={{ color: tokens.primary }} />
          </div>
          <h1 className="text-xl font-black tracking-tight text-white font-heading">
            {t('auth.appName', undefined, 'AgriGuard')}
          </h1>
        </div>

        {/* Nav items */}
        <nav aria-label="Main Navigation" className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentScreen === item.id;
            return (
              <button
                key={item.id}
                role="link"
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onNavigate(item.id)}
                style={
                  isActive
                    ? {
                        background: tokens.gradient,
                        color: tokens.contrast,
                        boxShadow: `0 0 20px ${tokens.glow}`,
                      }
                    : undefined
                }
                className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-2xl text-[13px] font-bold transition-all duration-200 text-left cursor-pointer ${
                  isActive
                    ? 'font-extrabold'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon
                  className="w-[18px] h-[18px] shrink-0"
                  style={{
                    color: isActive ? tokens.contrast : tokens.text,
                    strokeWidth: isActive ? 2.5 : 2,
                  }}
                />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Profile + Logout */}
      <div className="pt-4 border-t border-white/10 space-y-3 mt-4">
        <div className="flex items-center gap-3 px-2">
          <div
            className="w-10 h-10 rounded-full overflow-hidden border-2 flex-shrink-0 transition-all duration-300"
            style={{
              borderColor: tokens.border,
              boxShadow: `0 0 12px ${tokens.glow}`,
            }}
          >
            <img
              src={avatarSrc}
              alt={`${user?.name || 'User'} profile avatar`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150';
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-extrabold text-white truncate">
              {user?.name || (role === 'EXPERT' ? t('roles.expert', undefined, 'Expert') : role === 'OFFICER' ? t('roles.officer', undefined, 'Officer') : t('roles.farmer', undefined, 'Farmer'))}
            </div>
            <div className="mt-0.5">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full inline-block"
                style={{
                  backgroundColor: tokens.badgeBg,
                  color: tokens.badgeText,
                  borderColor: tokens.badgeBorder,
                  borderWidth: '1px',
                  borderStyle: 'solid',
                }}
              >
                {tokens.label}
              </span>
            </div>
          </div>
        </div>

        <div className="pt-1">
          <LanguageSelector variant="dropdown" direction="up" className="w-full" />
        </div>

        <button
          onClick={logout}
          aria-label={t('common.logout', undefined, 'Logout')}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold text-red-400 bg-red-950/35 hover:bg-red-900/50 border border-red-500/25 transition cursor-pointer"
        >
          <LogOut className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>{t('common.logout', undefined, 'Logout')}</span>
        </button>
      </div>
    </aside>
  );
};
