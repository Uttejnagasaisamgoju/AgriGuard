import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Users, AlertTriangle, CheckCircle2,
  MapPin, FileText, MessageSquare, Map, ChevronRight,
  RefreshCw, Check, Archive, Calendar, UserCheck
} from 'lucide-react';
import { officerApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';
import type { OfficerDashboardData, OfficerCase } from '../types';
import { OfficerCaseModal } from './OfficerCaseModal';
import { FieldVisitModal } from './FieldVisitModal';
import { FieldReportModal } from './FieldReportModal';

interface OfficerDashboardViewProps {
  onBack: () => void;
  onNavigateMap: () => void;
  onNavigateChat: () => void;
}

export const OfficerDashboardView: React.FC<OfficerDashboardViewProps> = ({
  onBack,
  onNavigateMap,
  onNavigateChat,
}) => {
  const { t, formatDate } = useLanguage();
  const [data, setData] = useState<OfficerDashboardData | null>(null);
  const [cases, setCases] = useState<OfficerCase[]>([]);
  const [caseTab, setCaseTab] = useState<'active' | 'resolved'>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Modals state
  const [selectedCase, setSelectedCase] = useState<OfficerCase | null>(null);
  const [visitModalCase, setVisitModalCase] = useState<OfficerCase | null>(null);
  const [reportModalCase, setReportModalCase] = useState<OfficerCase | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError('');
    try {
      const [dashRes, casesRes] = await Promise.allSettled([
        officerApi.getDashboard(),
        officerApi.getCases({ limit: 100 }),
      ]);

      if (dashRes.status === 'fulfilled') {
        setData(dashRes.value);
      }
      if (casesRes.status === 'fulfilled') {
        setCases(casesRes.value.cases || []);
      } else if (dashRes.status === 'fulfilled' && dashRes.value.recent_cases) {
        setCases(dashRes.value.recent_cases);
      }
    } catch (err: any) {
      setError('Unable to load officer data from database.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    caseId: string,
    newStatus: string,
    notes: string,
    resolutionNotes?: string
  ) => {
    try {
      await officerApi.updateCase(caseId, {
        status: newStatus,
        officer_notes: notes,
        resolution_notes: resolutionNotes,
      });
      showToast('Case status updated successfully in database.');
      loadDashboard();
    } catch (err: any) {
      showToast('Failed to update case.');
    }
  };

  const handleScheduleVisit = async (visitData: any) => {
    try {
      await officerApi.scheduleFieldVisit({
        case_id: visitData.case_id,
        scheduled_date: visitData.scheduled_date,
        notes: visitData.notes,
      });
      showToast('Field visit scheduled successfully.');
      setVisitModalCase(null);
      loadDashboard();
    } catch (err) {
      showToast('Failed to record field visit.');
    }
  };

  const handleAddReport = async (reportData: any) => {
    try {
      await officerApi.addFieldReport({
        case_id: reportData.case_id,
        title: reportData.title,
        content: `${reportData.observations}\n\nRecommendations:\n${reportData.recommendations}`,
        recommendations: reportData.recommendations,
      });
      showToast('Field report saved to database.');
      setReportModalCase(null);
      loadDashboard();
    } catch (err) {
      showToast('Failed to save report.');
    }
  };

  const activeCases = cases.filter((c) => c.status !== 'RESOLVED');
  const resolvedCases = cases.filter((c) => c.status === 'RESOLVED');

  const stats = data?.stats;
  const farmersMonitored = stats?.farmers_monitored ?? 0;
  const issuesDetected = activeCases.length;
  const resolvedToday = resolvedCases.length;

  const statCards = [
    {
      label: t('officer.farmersMonitored', undefined, 'Farmers Monitored'),
      value: farmersMonitored,
      icon: Users,
      color: 'bg-emerald-500/20',
      iconColor: 'text-emerald-400',
    },
    {
      label: t('officer.activeCases', undefined, 'Active Cases'),
      value: issuesDetected,
      icon: AlertTriangle,
      color: 'bg-amber-500/20',
      iconColor: 'text-amber-400',
    },
    {
      label: t('officer.resolvedCases', undefined, 'Resolved Cases'),
      value: resolvedToday,
      icon: CheckCircle2,
      color: 'bg-cyan-500/20',
      iconColor: 'text-cyan-400',
    },
  ];

  const quickActions = [
    {
      label: t('officer.fieldVisit', undefined, 'Field Visit'),
      icon: MapPin,
      action: () => {
        if (activeCases.length > 0) {
          setVisitModalCase(activeCases[0]);
        } else {
          onNavigateMap();
        }
      },
    },
    {
      label: t('officer.addReport', undefined, 'Add Report'),
      icon: FileText,
      action: () => {
        if (activeCases.length > 0) {
          setReportModalCase(activeCases[0]);
        } else {
          showToast('No active case available to create report.');
        }
      },
    },
    { label: t('officer.messageFarmer', undefined, 'Message Farmer'), icon: MessageSquare, action: onNavigateChat },
    { label: t('officer.viewMaps', undefined, 'View Maps'), icon: Map, action: onNavigateMap },
  ];

  const getPriorityBadge = (priority: string) => {
    const p = (priority || 'normal').toLowerCase();
    if (p === 'critical' || p === 'high') {
      return 'bg-red-500/20 text-red-400 border border-red-500/35';
    }
    if (p === 'medium') {
      return 'bg-amber-500/20 text-amber-300 border border-amber-500/35';
    }
    return 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/35';
  };

  const formatLocalDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    return formatDate(dateStr);
  };

  return (
    <div className="space-y-4 animate-fade-in-up">
      {/* Toast */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 bg-emerald-900/90 text-emerald-200 border border-emerald-500/40 px-4 py-2.5 rounded-xl shadow-xl backdrop-blur-md animate-fade-in text-xs font-semibold">
          <Check className="w-4 h-4 text-emerald-400" />
          {toastMessage}
        </div>
      )}

      {/* Sticky Header Bar — Pinned on scroll */}
      <div className="sticky top-0 z-30 -mt-2 py-3 bg-[#0a180f]/95 backdrop-blur-xl border-b border-emerald-500/20 -mx-3 sm:-mx-6 px-3 sm:px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="lg:hidden p-2 rounded-xl hover:bg-emerald-900/30 transition">
            <ArrowLeft className="w-5 h-5 text-emerald-300" />
          </button>
          <div>
            <h1 className="text-xl font-black text-white font-heading">{t('officer.dashboard', undefined, 'Officer Dashboard')}</h1>
            <p className="text-emerald-300/70 text-xs mt-0.5">{t('officer.assignedCases', undefined, 'Agricultural Extension & Field Pathology')}</p>
          </div>
        </div>

        <button
          onClick={loadDashboard}
          disabled={loading}
          className="btn-secondary text-xs py-1.5 px-3 flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>{t('common.refresh', undefined, 'Refresh')}</span>
        </button>
      </div>

      {error && (
        <div className="glass-card p-3 flex items-center justify-between border-red-500/30">
          <span className="text-red-300 text-xs">{error}</span>
          <button onClick={loadDashboard} className="btn-secondary text-xs py-1 px-2.5">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* 3 Stat Cards — Real Database Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass-card p-4 flex items-center gap-3.5 border border-emerald-500/20 text-left">
              <div className={`w-12 h-12 rounded-2xl ${card.color} border border-emerald-400/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_15px_rgba(16,185,129,0.15)]`}>
                <Icon className={`w-6 h-6 ${card.iconColor}`} />
              </div>
              <div>
                <div className="text-2xl font-black text-white">{card.value}</div>
                <div className="text-[11px] text-emerald-300/70 font-semibold">{card.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Field Cases Container with Active vs Resolved Tabs */}
      <div className="glass-card p-4 space-y-3.5 border border-emerald-500/20">
        <div className="flex items-center justify-between flex-wrap gap-2 pb-2 border-b border-emerald-500/20">
          <div>
            <h2 className="text-sm font-bold text-white">Field Cases Management</h2>
            <p className="text-[11px] text-emerald-300/60">
              {caseTab === 'active' ? 'Active pathology cases requiring inspection or treatment' : 'Completed and validated disease cases'}
            </p>
          </div>

          <div className="flex items-center gap-1.5 bg-emerald-950/70 p-1 rounded-xl border border-emerald-500/30">
            <button
              type="button"
              onClick={() => setCaseTab('active')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                caseTab === 'active'
                  ? 'bg-emerald-500 text-emerald-950 shadow-sm'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>{t('officer.activeCases', undefined, 'Active Cases')} ({activeCases.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setCaseTab('resolved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                caseTab === 'resolved'
                  ? 'bg-emerald-500 text-emerald-950 shadow-sm'
                  : 'text-emerald-300/70 hover:text-white'
              }`}
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{t('officer.resolvedCases', undefined, 'Resolved Cases')} ({resolvedCases.length})</span>
            </button>
          </div>
        </div>

        {/* Case List or Resolved Table — Internal Smooth Scrolling */}
        {caseTab === 'active' ? (
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto overscroll-contain pr-1">
            {activeCases.length > 0 ? (
              activeCases.map((caseItem) => (
                <div
                  key={caseItem.id}
                  onClick={() => setSelectedCase(caseItem)}
                  className="flex items-center justify-between p-3 rounded-xl bg-emerald-950/40 hover:bg-emerald-900/30 border border-emerald-500/15 transition cursor-pointer group"
                >
                  <div className="space-y-0.5 text-left">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-white group-hover:text-emerald-300 transition">
                        {caseItem.farm_name || 'Farm Area'} {caseItem.farmer_name ? `• ${caseItem.farmer_name}` : ''}
                      </p>
                    </div>
                    <p className="text-[11px] text-emerald-300/80">{caseItem.title}</p>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[10px] text-emerald-400/60 font-medium">
                      {caseItem.time_ago || (caseItem.created_at ? formatTimeAgo(caseItem.created_at) : 'Active')}
                    </span>
                    <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${getPriorityBadge(caseItem.priority)}`}>
                      {caseItem.priority || 'Normal'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-emerald-300/60 text-xs">
                <CheckCircle2 className="w-8 h-8 text-emerald-500/40 mb-2" />
                <p className="font-semibold text-emerald-200/80">No active field issues</p>
                <p className="text-[11px] text-emerald-400/50 mt-0.5">All monitored farms are healthy with no pending cases.</p>
              </div>
            )}
          </div>
        ) : (
          /* Resolved Cases Table / List */
          <div className="space-y-2.5 max-h-[460px] overflow-y-auto overscroll-contain pr-1">
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
                    <span>Officer: {caseItem.resolved_by_name || 'Agricultural Officer'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center text-emerald-300/60 text-xs">
                <Archive className="w-8 h-8 text-emerald-500/40 mb-2" />
                <p className="font-semibold text-emerald-200/80">No resolved cases on file</p>
                <p className="text-[11px] text-emerald-400/50 mt-0.5">When active cases are diagnosed, treated, and closed, their history will appear here.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Quick Actions Grid — 4 Buttons */}
      <div className="space-y-2.5">
        <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider text-left">Quick Actions</h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.label}
                onClick={action.action}
                className="glass-card p-3.5 flex flex-col items-center justify-center gap-2 hover:border-emerald-400/50 hover:bg-emerald-900/30 transition-all cursor-pointer group border border-emerald-500/20"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-400/30 flex items-center justify-center group-hover:scale-105 transition shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                  <Icon className="w-5 h-5 text-emerald-400" />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-300 transition">{action.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Case Details / History Modal */}
      {selectedCase && (
        <OfficerCaseModal
          caseItem={selectedCase}
          isOpen={!!selectedCase}
          onClose={() => setSelectedCase(null)}
          onScheduleVisit={(c) => {
            setSelectedCase(null);
            setVisitModalCase(c);
          }}
          onSubmitReport={(c) => {
            setSelectedCase(null);
            setReportModalCase(c);
          }}
          onMessageFarmer={() => {
            setSelectedCase(null);
            onNavigateChat();
          }}
          onUpdateStatus={handleUpdateStatus}
        />
      )}

      {/* Field Visit Scheduling Modal */}
      {visitModalCase && (
        <FieldVisitModal
          caseItem={visitModalCase}
          isOpen={!!visitModalCase}
          onClose={() => setVisitModalCase(null)}
          onScheduled={handleScheduleVisit}
        />
      )}

      {/* Field Report Modal */}
      {reportModalCase && (
        <FieldReportModal
          caseItem={reportModalCase}
          isOpen={!!reportModalCase}
          onClose={() => setReportModalCase(null)}
          onSubmit={handleAddReport}
        />
      )}
    </div>
  );
};

function formatTimeAgo(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} mins ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours} hours ago`;
    const days = Math.floor(hours / 24);
    return `${days} days ago`;
  } catch {
    return 'Recently';
  }
}
