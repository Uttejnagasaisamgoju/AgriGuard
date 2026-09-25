import React, { useState } from 'react';
import { Leaf, Bell, Sun, UserCheck, CheckCircle2, Smartphone, Monitor, LayoutGrid } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { UserRole } from '../types';

export type ViewMode = 'app' | 'web' | 'grid';

interface HeaderBarProps {
  onOpenNotifications?: () => void;
  unreadCount?: number;
  viewMode?: ViewMode;
  onViewModeChange?: (mode: ViewMode) => void;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({ 
  unreadCount = 2, 
  onOpenNotifications,
  viewMode = 'web',
  onViewModeChange
}) => {
  const { user } = useAuth();
  const { t } = useLanguage();

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'OFFICER': return t('roles.officer');
      case 'EXPERT': return t('roles.expert');
      case 'ADMIN': return t('roles.admin');
      default: return t('roles.farmer');
    }
  };

  return (
    <header className="w-full flex items-center justify-between px-3 sm:px-5 py-2.5 border-b border-emerald-500/20 bg-emerald-950/60 backdrop-blur-xl sticky top-0 z-40">
      {/* Brand / Title */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 flex-shrink-0">
          <Leaf className="w-4 h-4 text-emerald-950 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-emerald-300 via-emerald-100 to-green-400 bg-clip-text text-transparent font-heading">
            {t('auth.appName', undefined, 'AgriGuard')}
          </h1>
          <p className="text-[9px] text-emerald-400/80 font-medium tracking-wide uppercase hidden sm:block">
            {t('common.brandTagline', undefined, 'Smart Farming • Healthy Crops')}
          </p>
        </div>
      </div>

      {/* Center View Mode Switcher: App vs Web vs 8-Screen Grid */}
      <div className="flex items-center bg-emerald-950/70 p-1 rounded-full border border-emerald-500/30 shadow-inner">
        <button
          onClick={() => onViewModeChange?.('app')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition ${
            viewMode === 'app'
              ? 'bg-emerald-500 text-emerald-950 shadow-md'
              : 'text-emerald-300/80 hover:text-white'
          }`}
          title={t('nav.appView', undefined, 'Mobile App View')}
        >
          <Smartphone className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">{t('nav.appView', undefined, 'App View')}</span>
        </button>

        <button
          onClick={() => onViewModeChange?.('web')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition ${
            viewMode === 'web'
              ? 'bg-emerald-500 text-emerald-950 shadow-md'
              : 'text-emerald-300/80 hover:text-white'
          }`}
          title={t('nav.webView', undefined, 'Desktop Web View')}
        >
          <Monitor className="w-3.5 h-3.5" />
          <span className="hidden xs:inline">{t('nav.webView', undefined, 'Web View')}</span>
        </button>

        <button
          onClick={() => onViewModeChange?.('grid')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold transition ${
            viewMode === 'grid'
              ? 'bg-emerald-500 text-emerald-950 shadow-md'
              : 'text-emerald-300/80 hover:text-white'
          }`}
          title={t('nav.gridShowcase', undefined, '8-Screen Grid')}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('nav.gridShowcase', undefined, '8-Screen Grid')}</span>
        </button>
      </div>

      {/* Right actions: Language, Weather, Persona & Notifications */}
      <div className="flex items-center gap-1.5 sm:gap-2.5">
        {/* Global Multilingual Selector */}
        <LanguageSelector variant="dropdown" />

        {/* Weather Pill (Screen B & C) */}
        <div className="hidden xl:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/40 border border-emerald-500/30 text-xs font-semibold text-emerald-200">
          <Sun className="w-3.5 h-3.5 text-amber-400" />
          <span>28°C Partly Cloudy</span>
          <span className="text-[10px] text-emerald-400/70">Nizamabad, TG</span>
        </div>

        {/* User Role Badge */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-900/50 border border-emerald-500/30 text-emerald-300">
          <UserCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{getRoleLabel(user?.role)}</span>
        </div>

        {/* Notifications Icon */}
        <button
          onClick={onOpenNotifications}
          className="relative p-2 rounded-full bg-emerald-900/30 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-800/40 transition cursor-pointer"
          title={t('nav.notifications', undefined, 'Notifications')}
          aria-label={t('nav.notifications', undefined, 'Notifications')}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
