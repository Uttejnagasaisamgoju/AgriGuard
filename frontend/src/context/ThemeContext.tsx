import React, { createContext, useContext, useState, useEffect } from 'react';
import { UserRole } from '../types';
import { useAuth } from './AuthContext';

export interface RoleThemeTokens {
  role: UserRole;
  label: string;
  primary: string;
  primaryHover: string;
  gradient: string;
  gradientHover: string;
  soft: string;
  border: string;
  glow: string;
  text: string;
  contrast: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const ROLE_THEMES: Record<UserRole, RoleThemeTokens> = {
  FARMER: {
    role: 'FARMER',
    label: 'Farmer',
    primary: '#10b981',
    primaryHover: '#059669',
    gradient: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    gradientHover: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
    soft: 'rgba(16, 185, 129, 0.15)',
    border: 'rgba(52, 211, 153, 0.35)',
    glow: 'rgba(16, 185, 129, 0.35)',
    text: '#34d399',
    contrast: '#03231a',
    badgeBg: 'rgba(16, 185, 129, 0.18)',
    badgeText: '#34d399',
    badgeBorder: 'rgba(16, 185, 129, 0.4)',
  },
  OFFICER: {
    role: 'OFFICER',
    label: 'Agricultural Officer',
    primary: '#f59e0b',
    primaryHover: '#d97706',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    gradientHover: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    soft: 'rgba(245, 158, 11, 0.15)',
    border: 'rgba(245, 158, 11, 0.35)',
    glow: 'rgba(245, 158, 11, 0.35)',
    text: '#fbbf24',
    contrast: '#241400',
    badgeBg: 'rgba(245, 158, 11, 0.18)',
    badgeText: '#fbbf24',
    badgeBorder: 'rgba(245, 158, 11, 0.4)',
  },
  EXPERT: {
    role: 'EXPERT',
    label: 'Agronomy Expert',
    primary: '#06b6d4',
    primaryHover: '#0891b2',
    gradient: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    gradientHover: 'linear-gradient(135deg, #22d3ee 0%, #06b6d4 100%)',
    soft: 'rgba(6, 182, 212, 0.15)',
    border: 'rgba(6, 182, 212, 0.35)',
    glow: 'rgba(6, 182, 212, 0.35)',
    text: '#22d3ee',
    contrast: '#032029',
    badgeBg: 'rgba(6, 182, 212, 0.18)',
    badgeText: '#22d3ee',
    badgeBorder: 'rgba(6, 182, 212, 0.4)',
  },
  ADMIN: {
    role: 'ADMIN',
    label: 'System Administrator',
    primary: '#8b5cf6',
    primaryHover: '#7c3aed',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)',
    gradientHover: 'linear-gradient(135deg, #a78bfa 0%, #8b5cf6 100%)',
    soft: 'rgba(139, 92, 246, 0.15)',
    border: 'rgba(139, 92, 246, 0.35)',
    glow: 'rgba(139, 92, 246, 0.35)',
    text: '#a78bfa',
    contrast: '#1e1035',
    badgeBg: 'rgba(139, 92, 246, 0.18)',
    badgeText: '#a78bfa',
    badgeBorder: 'rgba(139, 92, 246, 0.4)',
  },
};

interface ThemeContextType {
  role: UserRole;
  tokens: RoleThemeTokens;
  setRoleTheme: (role: UserRole) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeRole, setActiveRole] = useState<UserRole>(() => {
    return (user?.role as UserRole) || 'FARMER';
  });

  // Keep theme synced with backend authenticated user role
  useEffect(() => {
    if (user?.role) {
      setActiveRole(user.role as UserRole);
    }
  }, [user?.role]);

  // Set the data-role attribute on documentElement for instant CSS token cascade
  useEffect(() => {
    const roleSlug = activeRole.toLowerCase();
    document.documentElement.setAttribute('data-role', roleSlug);
  }, [activeRole]);

  const setRoleTheme = (role: UserRole) => {
    setActiveRole(role);
    document.documentElement.setAttribute('data-role', role.toLowerCase());
  };

  const tokens = ROLE_THEMES[activeRole] || ROLE_THEMES.FARMER;

  return (
    <ThemeContext.Provider value={{ role: activeRole, tokens, setRoleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
