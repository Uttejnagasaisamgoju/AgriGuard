import React from 'react';
import {
  Home, Sprout, BarChart3, MessageSquare, Settings,
  Users, MapPin, BookOpen, Scan, Bot
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';

interface BottomNavBarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
}

export const BottomNavBar: React.FC<BottomNavBarProps> = ({ currentTab, onTabChange }) => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const role = (user?.role || 'farmer').toUpperCase();

  let tabs: Array<{ id: string; label: string; icon: any }> = [];

  if (role === 'OFFICER') {
    tabs = [
      { id: 'home', label: t('nav.home', undefined, 'Home'), icon: Home },
      { id: 'ai-assistant', label: t('nav.aiAssistant', undefined, 'AI Bot'), icon: Bot },
      { id: 'farmers', label: t('nav.farmers', undefined, 'Farmers'), icon: Users },
      { id: 'reports', label: t('nav.reports', undefined, 'Reports'), icon: BarChart3 },
      { id: 'settings', label: t('nav.settings', undefined, 'Settings'), icon: Settings },
    ];
  } else if (role === 'EXPERT') {
    tabs = [
      { id: 'home', label: t('nav.home', undefined, 'Home'), icon: Home },
      { id: 'ai-assistant', label: t('nav.aiAssistant', undefined, 'AI Bot'), icon: Bot },
      { id: 'chat', label: t('nav.chatQueue', undefined, 'Consult'), icon: MessageSquare },
      { id: 'disease-library', label: t('nav.diseaseLibrary', undefined, 'Library'), icon: BookOpen },
      { id: 'settings', label: t('nav.settings', undefined, 'Settings'), icon: Settings },
    ];
  } else {
    tabs = [
      { id: 'home', label: t('nav.home', undefined, 'Home'), icon: Home },
      { id: 'ai-assistant', label: t('nav.aiAssistant', undefined, 'AI Bot'), icon: Bot },
      { id: 'disease-detect', label: t('nav.diseaseDetect', undefined, 'Scan'), icon: Scan },
      { id: 'chat', label: t('nav.expertChat', undefined, 'Expert'), icon: MessageSquare },
      { id: 'settings', label: t('nav.settings', undefined, 'Settings'), icon: Settings },
    ];
  }

  const isActive = (id: string) => {
    return currentTab === id;
  };

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const active = isActive(tab.id);
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`bottom-nav-item ${active ? 'active' : ''}`}
          >
            <Icon className={`w-5 h-5 ${active ? 'text-[var(--role-primary-text)]' : ''}`} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
