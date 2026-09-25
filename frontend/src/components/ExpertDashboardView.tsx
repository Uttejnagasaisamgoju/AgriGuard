import React, { useEffect, useState } from 'react';
import {
  MessageSquare, HelpCircle, Users, Star,
  CheckCircle2, Bell, BookOpen, Clock, ShieldCheck,
  ChevronRight, ArrowRight, ToggleLeft, ToggleRight, Sparkles,
  Archive, Check
} from 'lucide-react';
import { expertApi, officerApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import type { ExpertDashboardData, ExpertConsultationItem, OfficerCase } from '../types';
import { OfficerCaseModal } from './OfficerCaseModal';

interface ExpertDashboardViewProps {
  onNavigateChat: () => void;
  onNavigateLibrary: () => void;
  onNavigateSettings: () => void;
  onOpenNotifications?: () => void;
}

export const ExpertDashboardView: React.FC<ExpertDashboardViewProps> = ({
  onNavigateChat,
  onNavigateLibrary,
  onNavigateSettings,
  onOpenNotifications,
}) => {
  const { user } = useAuth();
  const { t, formatDate } = useLanguage();
  const [data, setData] = useState<ExpertDashboardData | null>(null);
  const [resolvedCases, setResolvedCases] = useState<OfficerCase[]>([]);
  const [activeTab, setActiveTab] = useState<'consultations' | 'resolved'>('consultations');
  const [selectedCase, setSelectedCase] = useState<OfficerCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [updatingOnline, setUpdatingOnline] = useState(false);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, resolvedRes] = await Promise.allSettled([
        expertApi.getDashboard(),
        expertApi.getCases({ status: 'RESOLVED', limit: 50 }),
      ]);

      if (dashRes.status === 'fulfilled') {
        setData(dashRes.value);
        setIsOnline(dashRes.value.expert?.is_online ?? true);
      }
      if (resolvedRes.status === 'fulfilled') {
        setResolvedCases(resolvedRes.value.cases || []);
      }
    } catch (err) {
      console.error('Failed to load expert dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleOnline = async () => {
    if (updatingOnline) return;
    setUpdatingOnline(true);
    const newStatus = !isOnline;
    try {
      await expertApi.updateAvailability(newStatus);
      setIsOnline(newStatus);
    } catch (err) {
      console.error('Failed to update availability:', err);
    } finally {
      setUpdatingOnline(false);
    }
  };

  const formatLocalDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return formatDate(dateStr);
  };

  const stats = data?.stats;
  const activeConversations = stats?.active_conversations ?? 0;
  const pendingQuestions = stats?.pending_questions ?? 0;
  const farmersHelped = stats?.farmers_helped ?? 0;
  const avgRating = stats?.avg_rating ?? '4.9';

  const statCards = [
    {
      label: t('expert.activeConversations', undefined, 'Active Conversations'),
      value: activeConversations,
      icon: MessageSquare,
      color: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
      border: 'border-emerald-500/30',
    },
    {
      label: t('expert.pendingQuestions', undefined, 'Pending Questions'),
      value: pendingQuestions,
      icon: HelpCircle,
      color: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    {
      label: t('expert.farmersHelped', undefined, 'Farmers Helped'),
      value: farmersHelped,
      icon: Users,
      color: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
      border: 'border-cyan-500/30',
    },
    {
      label: t('expert.avgRating', undefined, 'Avg. Rating'),
      value: avgRating,
      icon: Star,
      color: 'bg-yellow-500/20',
      iconColor: 'text-yellow-400',
      border: 'border-yellow-500/30',
    },
  ];

  const quickActions = [
    {
      label: t('nav.chatQueue', undefined, 'Open Chat Queue'),
      subtitle: `${pendingQuestions} ${t('expert.pendingQuestions', undefined, 'pending inquiries')}`,
      icon: MessageSquare,
      action: onNavigateChat,
    },
    {
      label: t('nav.diseaseLibrary', undefined, 'Disease Library'),
      subtitle: t('library.browsePathologies', undefined, 'Browse plant pathologies'),
      icon: BookOpen,
      action: onNavigateLibrary,
    },
    {
      label: isOnline ? t('expert.goOffline', undefined, 'Go Offline') : t('expert.goOnline', undefined, 'Go Online'),
      subtitle: isOnline ? t('expert.acceptingConsultations', undefined, 'Accepting consultations') : t('expert.currentlyPaused', undefined, 'Currently paused'),
      icon: isOnline ? ToggleRight : ToggleLeft,
      action: handleToggleOnline,
    },
    {
      label: t('settings.profile', undefined, 'View Profile'),
      subtitle: t('expert.credentialsSpecialties', undefined, 'Credentials & specialties'),
      icon: ShieldCheck,
      action: onNavigateSettings,
    },
  ];

  const consultations = data?.incoming_consultations || [];

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-black text-white font-heading">
              Hello, {user?.name?.startsWith('Dr.') ? user?.name : `Dr. ${user?.name || 'Expert'}`} 👋
            </h1>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 text-[10px] font-bold">
              <Sparkles className="w-3 h-3 text-emerald-400" />
              Verified Expert
            </span>
          </div>
          <p className="text-xs text-emerald-300/70 mt-0.5">
            Plant Pathology &amp; Agronomy Consultation Desk
          </p>
        </div>

        {/* Availability Toggle & Notifications */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleOnline}
            disabled={updatingOnline}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              isOnline
                ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300'
                : 'bg-zinc-800/60 border-zinc-600/40 text-zinc-400'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'}`} />
            <span>{isOnline ? t('expert.onlineStatus', undefined, 'Online / Available') : t('expert.offlineStatus', undefined, 'Offline')}</span>
          </button>

          {onOpenNotifications && (
            <button
              onClick={onOpenNotifications}
              className="p-2 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-emerald-300 hover:text-white transition cursor-pointer"
              title={t('nav.notifications', undefined, 'Notifications')}
            >
              <Bell className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className={`glass-card p-4 flex flex-col justify-between border ${stat.border}`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-emerald-300/70">{stat.label}</span>
                <div className={`w-7 h-7 rounded-lg ${stat.color} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${stat.iconColor}`} />
                </div>
              </div>
              <div className="text-2xl font-black text-white font-heading">
                {loading ? <span className="inline-block w-8 h-6 skeleton rounded" /> : stat.value}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Actions Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {quickActions.map((qa) => {
          const Icon = qa.icon;
          return (
            <button
              key={qa.label}
              onClick={qa.action}
              className="glass-card p-3.5 text-left border border-emerald-500/20 hover:border-emerald-400/50 hover:bg-emerald-950/40 transition group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition flex-shrink-0">
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-white truncate">{qa.label}</div>
                  <div className="text-[10px] text-emerald-300/60 truncate">{qa.subtitle}</div>
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Consultations and Resolved Cases Container */}
      <div className="glass-card p-4 border border-emerald-500/20 space-y-3.5">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-500/20">
          <div className="flex items-center gap-1.5 bg-emerald-950/70 p-1 rounded-xl border border-emerald-500/30">
            <button
              type="button"
              onClick={() => setActiveTab('consultations')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'consultations'
                  ? 'bg-emerald-500 text-emerald-950 shadow-sm'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>{t('expert.incomingConsultations', undefined, 'Incoming Consultations')} ({consultations.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('resolved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'resolved'
                  ? 'bg-emerald-500 text-emerald-950 shadow-sm'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('expert.resolvedCases', undefined, 'Resolved Cases')} ({resolvedCases.length})</span>
            </button>
          </div>

          {activeTab === 'consultations' && (
            <button
              onClick={onNavigateChat}
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
            >
              <span>{t('expert.openQueue', undefined, 'Open Queue')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {activeTab === 'consultations' ? (
          loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 skeleton rounded-xl" />
              ))}
            </div>
          ) : consultations.length === 0 ? (
            <div className="p-8 text-center text-emerald-300/60 text-xs">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-emerald-500/40" />
              <p className="font-semibold text-white">No incoming consultations yet</p>
              <p className="text-[11px] mt-0.5">When farmers submit disease queries or request assistance, they will appear here in real-time.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {consultations.map((c) => {
                const priorityColor =
                  c.priority === 'High'
                    ? 'bg-red-500/20 text-red-400 border-red-500/35'
                    : c.priority === 'Medium'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/35'
                    : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/35';

                return (
                  <div
                    key={c.id}
                    onClick={onNavigateChat}
                    className="glass-card p-3 flex items-center justify-between gap-3 border border-emerald-500/15 hover:border-emerald-400/40 hover:bg-emerald-950/40 transition cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 text-xs font-black flex-shrink-0">
                        {c.farmer_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                            {c.farmer_name}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-900/40 text-emerald-300 font-semibold border border-emerald-500/20">
                            {c.crop}
                          </span>
                        </div>
                        <p className="text-[11px] text-emerald-200/80 truncate mt-0.5">
                          {c.topic}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-[10px] text-emerald-300/60 font-medium hidden sm:inline">
                        {c.time}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${priorityColor}`}>
                        {c.priority}
                      </span>
                      <ChevronRight className="w-4 h-4 text-emerald-400/60 group-hover:text-emerald-300 transition" />
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          /* Resolved Cases Tab for Expert */
          <div className="space-y-2.5">
            {resolvedCases.length > 0 ? (
              resolvedCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  onClick={() => setSelectedCase(caseItem)}
                  className="p-3.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/30 border border-emerald-500/20 transition cursor-pointer group space-y-2 text-left"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                        {caseItem.farmer_name || 'Farmer'}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-500/30 font-medium">
                        {caseItem.farm_name || 'Farm Plot'}
                      </span>
                    </div>

                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Resolved
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-emerald-200/90 gap-2">
                    <span className="font-semibold text-white truncate">{caseItem.title}</span>
                    <span className="text-[10px] text-emerald-400/70 flex-shrink-0">
                      Resolved: {formatDate(caseItem.resolved_at)}
                    </span>
                  </div>

                  {caseItem.resolution_notes && (
                    <div className="text-[11px] text-emerald-300/80 bg-emerald-950/60 p-2 rounded-lg border border-emerald-500/15">
                      <span className="font-semibold text-emerald-200">Resolution: </span>
                      {caseItem.resolution_notes}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[10px] text-emerald-400/60 pt-0.5">
                    <span>Detected: {formatDate(caseItem.created_at)}</span>
                    <span>Resolved By: {caseItem.resolved_by_name || 'Agricultural Officer'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-emerald-300/60 text-xs">
                <Archive className="w-8 h-8 text-emerald-500/40 mb-2" />
                <p className="font-semibold text-emerald-200/80">No resolved cases on file</p>
                <p className="text-[11px] text-emerald-400/50 mt-0.5">When cases are closed with agronomist guidance, they are recorded here.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Case Timeline Modal if clicked */}
      {selectedCase && (
        <OfficerCaseModal
          caseItem={selectedCase}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          onScheduleVisit={() => setSelectedCase(null)}
          onSubmitReport={() => setSelectedCase(null)}
          onMessageFarmer={() => {
            setSelectedCase(null);
            onNavigateChat();
          }}
          onUpdateStatus={() => {
            setSelectedCase(null);
            loadDashboard();
          }}
        />
      )}
    </div>
  );
};
