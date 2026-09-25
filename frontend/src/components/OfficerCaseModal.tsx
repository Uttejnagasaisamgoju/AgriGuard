import React, { useState, useEffect } from 'react';
import {
  X, ShieldAlert, Calendar, FileText, Send, CheckCircle2,
  AlertTriangle, MapPin, Clock, Check, User, Bot, Sparkles,
  History, Eye, ChevronDown, ChevronUp
} from 'lucide-react';
import { OfficerCase, CaseHistoryTimelineEvent } from '../types';
import { officerApi } from '../services/api';
import { useLanguage } from '../context/LanguageContext';

interface OfficerCaseModalProps {
  caseItem: OfficerCase | null;
  isOpen: boolean;
  onClose: () => void;
  onScheduleVisit: (caseItem: OfficerCase) => void;
  onSubmitReport: (caseItem: OfficerCase) => void;
  onMessageFarmer: (farmerName: string) => void;
  onUpdateStatus: (caseId: string, newStatus: string, notes: string, resolutionNotes?: string) => void;
}

export const OfficerCaseModal: React.FC<OfficerCaseModalProps> = ({
  caseItem,
  isOpen,
  onClose,
  onScheduleVisit,
  onSubmitReport,
  onMessageFarmer,
  onUpdateStatus,
}) => {
  if (!isOpen || !caseItem) return null;

  const { t } = useLanguage();
  const [status, setStatus] = useState<string>(caseItem.status || 'NEW');
  const [notes, setNotes] = useState(caseItem.officer_notes || '');
  const [resolutionNotes, setResolutionNotes] = useState(caseItem.resolution_notes || '');
  const [isSaved, setIsSaved] = useState(false);
  const [timeline, setTimeline] = useState<CaseHistoryTimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [activeTab, setActiveTab] = useState<'details' | 'timeline'>('details');

  useEffect(() => {
    setStatus(caseItem.status || 'NEW');
    setNotes(caseItem.officer_notes || '');
    setResolutionNotes(caseItem.resolution_notes || '');
    loadTimeline(caseItem.id);
  }, [caseItem.id]);

  const loadTimeline = async (caseId: string) => {
    setLoadingTimeline(true);
    try {
      const res = await officerApi.getCaseHistory(caseId);
      if (res && res.timeline) {
        setTimeline(res.timeline);
      }
    } catch (err) {
      console.warn('Could not load case timeline:', err);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const handleSave = () => {
    onUpdateStatus(caseItem.id, status, notes, resolutionNotes);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 600);
  };

  const getStatusBadge = (st: string) => {
    switch (st) {
      case 'NEW':
        return <span className="badge-risk-high">{t('officer.newCases', undefined, 'NEW ISSUE')}</span>;
      case 'UNDER_REVIEW':
        return <span className="badge-risk-medium">{t('officer.underReview', undefined, 'UNDER REVIEW')}</span>;
      case 'FIELD_VISIT_REQUIRED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">{t('officer.fieldVisit', undefined, 'VISIT REQUIRED')}</span>;
      case 'TREATMENT_RECOMMENDED':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">{t('officer.recommendations', undefined, 'TREATMENT RECOMMENDED')}</span>;
      case 'RESOLVED':
        return <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1"><Check className="w-3 h-3" /> {t('officer.markResolved', undefined, 'RESOLVED')}</span>;
      default:
        return <span className="badge-risk-low">{st}</span>;
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-2xl rounded-2xl glass-panel p-6 border-emerald-500/30 max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold text-white font-heading">
                {status === 'RESOLVED' ? t('officer.resolvedCases', undefined, 'Resolved Case File') : t('officer.caseManagement', undefined, 'Officer Field Case Review')}
              </h2>
              <div className="text-[10px] text-emerald-400/80">Case #{caseItem.id.slice(0, 8)}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-emerald-900/50 text-emerald-400 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch between Details & Chronological Timeline */}
        <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('details')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'details'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                : 'text-emerald-400/60 hover:text-emerald-300'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>{t('officer.dashboard', undefined, 'Case Overview')}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('timeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'timeline'
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                : 'text-emerald-400/60 hover:text-emerald-300'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>{t('officer.caseManagement', undefined, 'Case History Timeline')} ({timeline.length})</span>
          </button>
        </div>

        {activeTab === 'details' ? (
          <>
            {/* Case Info Card */}
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-white text-sm">{caseItem.title}</h3>
                  <p className="text-xs text-emerald-300/80 flex items-center gap-1.5 mt-0.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{caseItem.farm_name || 'Farm Area'} • Farmer: {caseItem.farmer_name || 'Farmer'}</span>
                  </p>
                </div>
                {getStatusBadge(status)}
              </div>

              <div className="text-xs text-emerald-100/90 leading-relaxed bg-emerald-950/50 p-2.5 rounded-xl border border-emerald-500/20">
                {caseItem.description || 'Crop disease detected by automated AI leaf diagnostics. Requires agronomist review and agronomic advisement.'}
              </div>

              <div className="flex items-center justify-between text-[11px] text-emerald-400/70 pt-1">
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Detected: {formatDateTime(caseItem.created_at)}</span>
                </div>
                {caseItem.resolved_at && (
                  <div className="flex items-center gap-1.5 text-emerald-300 font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Resolved: {formatDateTime(caseItem.resolved_at)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Resolved Callout Banner if Case is Closed */}
            {status === 'RESOLVED' && (
              <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-300 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>Case Successfully Resolved</span>
                  </div>
                  <span className="text-[10px] text-emerald-400/80">
                    By: {caseItem.resolved_by_name || 'Agricultural Officer'}
                  </span>
                </div>
                {resolutionNotes ? (
                  <p className="text-xs text-emerald-200/90 leading-relaxed pl-5.5">
                    <span className="font-semibold text-emerald-300">Resolution Record: </span>
                    {resolutionNotes}
                  </p>
                ) : (
                  <p className="text-xs text-emerald-400/70 italic pl-5.5">
                    Pathogen controlled and farm plot cleared.
                  </p>
                )}
              </div>
            )}

            {/* Status Update Dropdown */}
            <div className="space-y-1 text-xs">
              <label className="block text-emerald-300 font-semibold">{t('officer.updateCase', undefined, 'Update Case Status')}</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="input-glass bg-[#061e16]"
              >
                <option value="NEW">{t('officer.newCases', undefined, 'New Case')}</option>
                <option value="UNDER_REVIEW">{t('officer.underReview', undefined, 'Under Review')}</option>
                <option value="FIELD_VISIT_REQUIRED">{t('officer.fieldVisit', undefined, 'Field Visit Required')}</option>
                <option value="TREATMENT_RECOMMENDED">{t('officer.recommendations', undefined, 'Treatment Recommended')}</option>
                <option value="RESOLVED">{t('officer.resolvedCases', undefined, 'Resolved')}</option>
              </select>
            </div>

            {/* Officer Assessment Notes */}
            <div className="space-y-1 text-xs">
              <label className="block text-emerald-300 font-semibold">{t('officer.inspectionReport', undefined, 'Officer Field Notes & Observations')}</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('officer.inspectionReport', undefined, 'Document field observations, disease severity assessment, or ongoing notes...')}
                className="input-glass"
              />
            </div>

            {/* Resolution Notes (Visible when RESOLVED or resolving) */}
            {status === 'RESOLVED' && (
              <div className="space-y-1 text-xs">
                <label className="block text-emerald-300 font-semibold">
                  {t('officer.recommendations', undefined, 'Resolution Notes & Final Treatment Summary')}
                </label>
                <textarea
                  rows={2}
                  value={resolutionNotes}
                  onChange={(e) => setResolutionNotes(e.target.value)}
                  placeholder={t('officer.recommendations', undefined, 'Summarize the final treatment applied, scouting outcome, and reason for closing case...')}
                  className="input-glass border-emerald-400/50"
                />
              </div>
            )}

            {/* Officer Quick Actions (Only active if not resolved or for follow-up) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => onScheduleVisit(caseItem)}
                className="py-2 px-2.5 rounded-xl bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex flex-col items-center gap-1 transition cursor-pointer"
              >
                <Calendar className="w-4 h-4 text-emerald-400" />
                <span>{t('officer.scheduleVisit', undefined, 'Schedule Visit')}</span>
              </button>
              <button
                type="button"
                onClick={() => onSubmitReport(caseItem)}
                className="py-2 px-2.5 rounded-xl bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex flex-col items-center gap-1 transition cursor-pointer"
              >
                <FileText className="w-4 h-4 text-emerald-400" />
                <span>{t('officer.addReport', undefined, 'Add Report')}</span>
              </button>
              <button
                type="button"
                onClick={() => onMessageFarmer(caseItem.farmer_name || 'Farmer')}
                className="py-2 px-2.5 rounded-xl bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold flex flex-col items-center gap-1 transition cursor-pointer"
              >
                <Send className="w-4 h-4 text-emerald-400" />
                <span>{t('officer.messageFarmer', undefined, 'Chat Farmer')}</span>
              </button>
            </div>
          </>
        ) : (
          /* Chronological Case History Timeline */
          <div className="space-y-3 py-1">
            {loadingTimeline ? (
              <div className="space-y-2 py-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 skeleton rounded-xl" />
                ))}
              </div>
            ) : timeline.length === 0 ? (
              <div className="text-center py-8 text-emerald-300/60 text-xs">
                <History className="w-8 h-8 mx-auto mb-2 text-emerald-500/40" />
                <p>{t('officer.caseManagement', undefined, 'No timeline events recorded yet for this case.')}</p>
              </div>
            ) : (
              <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-emerald-500/30">
                {timeline.map((event) => {
                  const isDetection = event.type === 'DETECTION';
                  const isAi = event.type === 'AI_DIAGNOSIS';
                  const isVisit = event.type === 'FIELD_VISIT';
                  const isReport = event.type === 'FIELD_REPORT';
                  const isExpert = event.type === 'EXPERT_FEEDBACK';
                  const isResolution = event.type === 'RESOLUTION';

                  const dotColor = isResolution
                    ? 'bg-emerald-400 ring-4 ring-emerald-500/30'
                    : isAi
                    ? 'bg-cyan-400 ring-4 ring-cyan-500/20'
                    : isExpert
                    ? 'bg-purple-400 ring-4 ring-purple-500/20'
                    : isVisit
                    ? 'bg-amber-400 ring-4 ring-amber-500/20'
                    : 'bg-emerald-500';

                  return (
                    <div key={event.id} className="relative group">
                      {/* Timeline Node Dot */}
                      <div className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full ${dotColor} flex-shrink-0 transition`} />

                      <div className="glass-card p-3 rounded-xl border border-emerald-500/20 space-y-1.5 text-left">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">{event.title}</span>
                            <span className="px-2 py-0.2 rounded-full text-[9px] font-extrabold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                              {event.badge || event.type}
                            </span>
                          </div>
                          <span className="text-[10px] text-emerald-400/60 font-medium">
                            {formatDateTime(event.timestamp)}
                          </span>
                        </div>

                        <p className="text-xs text-emerald-200/90 leading-relaxed whitespace-pre-line">
                          {event.description}
                        </p>

                        {event.author && (
                          <div className="text-[10px] text-emerald-400/70 pt-0.5 flex items-center gap-1">
                            <span>By:</span>
                            <span className="font-semibold text-emerald-300">{event.author}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Save footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-emerald-500/20">
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary py-2 px-4 text-xs font-bold cursor-pointer"
          >
            {t('common.close', undefined, 'Close')}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            {isSaved && <CheckCircle2 className="w-4 h-4" />}
            <span>{isSaved ? t('common.success', undefined, 'Updated!') : t('common.save', undefined, 'Save Status')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
