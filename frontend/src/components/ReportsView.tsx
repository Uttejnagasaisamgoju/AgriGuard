import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, Download, RefreshCw, Calendar, Sprout, AlertTriangle,
  CheckCircle2, Clock, MapPin, Droplets, Cloud, Wind, ShieldAlert,
  FileText, Plus, Trash2, X, AlertCircle, TrendingUp, BarChart3,
  Layers, ChevronRight, Activity, Info
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useFarm } from '../context/FarmContext';
import { useLanguage } from '../context/LanguageContext';
import { reportsApi } from '../services/api';
import { getLocalizedDisease } from '../utils/diseaseTranslations';
import type { FarmReportData, FarmReportHistoryItem, FarmTreatment, ReportData } from '../types';

interface ReportsViewProps {
  onBack: () => void;
  initialFarmId?: string | null;
}

const ACTION_TYPE_OPTIONS = [
  'Fungicide Application',
  'Pesticide Spray',
  'Fertilizer Top-Dressing',
  'Irrigation / Watering',
  'Weed Management',
  'Field Visit / Scouting',
  'Biological Control',
  'Pruning / Staking',
  'Soil Treatment',
  'Other Management Action',
];

export const ReportsView: React.FC<ReportsViewProps> = ({ onBack, initialFarmId }) => {
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const { farms, selectedFarm, selectFarm, loadingFarms } = useFarm();

  const getDisplayDisease = (name: string, crop?: string) => {
    if (!name) return name;
    const loc = getLocalizedDisease(name, crop || '', language);
    return loc ? loc.displayName : name;
  };

  const getDisplayCrop = (crop: string) => {
    if (!crop) return crop;
    const loc = getLocalizedDisease('', crop, language);
    return loc ? loc.displayCrop : crop;
  };

  const getLocalizedStatus = (statusStr: string) => {
    if (!statusStr) return statusStr;
    const s = statusStr.toLowerCase();
    if (s.includes('resolved')) return t('common.resolved', undefined, 'Resolved');
    if (s.includes('pending')) return t('common.pending', undefined, 'Pending');
    if (s.includes('review') || s.includes('observation')) return t('officer.underReview', undefined, 'Under Observation');
    return statusStr;
  };

  const getActionTypeLabel = (opt: string) => {
    switch (opt) {
      case 'Fungicide Application':
        return t('reports.actionFungicide', undefined, 'Fungicide Application');
      case 'Pesticide Spray':
        return t('reports.actionPesticide', undefined, 'Pesticide Spray');
      case 'Fertilizer Top-Dressing':
        return t('reports.actionFertilizer', undefined, 'Fertilizer Top-Dressing');
      case 'Irrigation / Watering':
        return t('reports.actionIrrigation', undefined, 'Irrigation / Watering');
      case 'Weed Management':
        return t('reports.actionWeed', undefined, 'Weed Management');
      case 'Field Visit / Scouting':
        return t('reports.actionScouting', undefined, 'Field Visit / Scouting');
      case 'Biological Control':
        return t('reports.actionBioControl', undefined, 'Biological Control');
      case 'Pruning / Staking':
        return t('reports.actionPruning', undefined, 'Pruning / Staking');
      case 'Soil Treatment':
        return t('reports.actionSoil', undefined, 'Soil Treatment');
      case 'Other Management Action':
        return t('reports.actionOther', undefined, 'Other Management Action');
      default:
        return opt;
    }
  };

  const getPeriodLabel = (pVal: string) => {
    switch (pVal) {
      case 'today': return t('reports.periodToday', undefined, 'Today');
      case '7d': return t('reports.period7Days', undefined, '7 Days');
      case '30d': return t('reports.period30Days', undefined, '30 Days');
      case 'this_month': return t('reports.periodThisMonth', undefined, 'This Month');
      case '365d': return t('reports.period1Year', undefined, '1 Year');
      default: return pVal;
    }
  };

  // Deep linking: select farm if provided via notification link
  useEffect(() => {
    if (initialFarmId && farms.length > 0) {
      const match = farms.find(f => f.id === initialFarmId);
      if (match) {
        selectFarm(match);
      }
    }
  }, [initialFarmId, farms]);

  // Active view tab: 'farm-report' (default per-farm deep dive) or 'analytics' (all-farms period aggregate)
  const [activeTab, setActiveTab] = useState<'farm-report' | 'analytics'>('farm-report');

  // Per-farm report state
  const [farmReport, setFarmReport] = useState<FarmReportData | null>(null);
  const [loadingFarmReport, setLoadingFarmReport] = useState(false);
  const [farmReportError, setFarmReportError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadSuccessMsg, setDownloadSuccessMsg] = useState<string | null>(null);

  // Treatment Action modal state
  const [isTreatmentModalOpen, setIsTreatmentModalOpen] = useState(false);
  const [treatmentActionType, setTreatmentActionType] = useState(ACTION_TYPE_OPTIONS[0]);
  const [treatmentDate, setTreatmentDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [treatmentDescription, setTreatmentDescription] = useState('');
  const [treatmentRelatedDisease, setTreatmentRelatedDisease] = useState('');
  const [treatmentNotes, setTreatmentNotes] = useState('');
  const [savingTreatment, setSavingTreatment] = useState(false);
  const [treatmentError, setTreatmentError] = useState<string | null>(null);

  // Analytics tab state
  const [period, setPeriod] = useState('this_month');
  const [analyticsReport, setAnalyticsReport] = useState<ReportData | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // Load report when selected farm changes
  useEffect(() => {
    if (selectedFarm?.id) {
      loadFarmReport(selectedFarm.id);
    } else if (farms.length > 0 && !selectedFarm) {
      selectFarm(farms[0]);
    }
  }, [selectedFarm?.id, farms.length]);

  // Load analytics when period changes
  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [period, activeTab]);

  const loadFarmReport = async (farmId: string) => {
    setLoadingFarmReport(true);
    setFarmReportError(null);
    try {
      const data = await reportsApi.getFarmReport(farmId);
      setFarmReport(data);
    } catch (err: any) {
      console.error('Failed to load farm report:', err);
      setFarmReportError(
        err?.response?.data?.detail || 'Report data is currently unavailable for this farm. Please try again.'
      );
    } finally {
      setLoadingFarmReport(false);
    }
  };

  const loadAnalytics = async () => {
    setLoadingAnalytics(true);
    try {
      const res = await reportsApi.getReports(period, selectedFarm?.id);
      setAnalyticsReport(res);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
    } finally {
      setLoadingAnalytics(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (!selectedFarm) return;
    setDownloadingPdf(true);
    setDownloadSuccessMsg(null);
    try {
      await reportsApi.downloadPdf(selectedFarm.id, selectedFarm.name, language);
      setDownloadSuccessMsg(t('reports.pdfDownloaded', undefined, 'Official PDF report downloaded successfully!'));
      // Refresh report to show updated report history
      loadFarmReport(selectedFarm.id);
      setTimeout(() => setDownloadSuccessMsg(null), 4000);
    } catch (err: any) {
      console.error('PDF download error:', err);
      alert(err?.response?.data?.detail || 'Unable to generate the PDF right now. Please try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handleSaveTreatment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFarm) return;
    if (!treatmentDescription.trim()) {
      setTreatmentError('Please enter a description for this action.');
      return;
    }
    setSavingTreatment(true);
    setTreatmentError(null);
    try {
      await reportsApi.createTreatment(selectedFarm.id, {
        action_type: treatmentActionType,
        date: treatmentDate,
        description: treatmentDescription.trim(),
        related_disease: treatmentRelatedDisease.trim() || undefined,
        notes: treatmentNotes.trim() || undefined,
      });
      setIsTreatmentModalOpen(false);
      setTreatmentDescription('');
      setTreatmentRelatedDisease('');
      setTreatmentNotes('');
      // Reload farm report to reflect new action
      loadFarmReport(selectedFarm.id);
    } catch (err: any) {
      console.error('Failed to save treatment:', err);
      setTreatmentError(err?.response?.data?.detail || 'Failed to save treatment record. Please try again.');
    } finally {
      setSavingTreatment(false);
    }
  };

  const handleDeleteTreatment = async (treatmentId: string) => {
    if (!selectedFarm) return;
    if (!confirm('Are you sure you want to remove this treatment record?')) return;
    try {
      await reportsApi.deleteTreatment(selectedFarm.id, treatmentId);
      loadFarmReport(selectedFarm.id);
    } catch (err: any) {
      alert(err?.response?.data?.detail || 'Failed to delete treatment record.');
    }
  };

  return (
    <div className="space-y-5 animate-fade-in-up pb-10">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="lg:hidden p-2 rounded-xl hover:bg-emerald-900/30 transition text-emerald-300"
            title="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-white font-heading">
              {t('reports.title', undefined, 'Farmer Reports & Advisory')}
            </h1>
            <p className="text-xs text-emerald-300/70 mt-0.5">
              {t('reports.farmerReportsSubtitle', undefined, 'Authoritative per-farm health records, sowing timeline, disease diagnostics, and official PDF generation.')}
            </p>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-emerald-950/60 border border-emerald-500/20 shrink-0">
          <button
            onClick={() => setActiveTab('farm-report')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'farm-report'
                ? 'bg-emerald-500 text-emerald-950 shadow-md font-extrabold'
                : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            {t('reports.farmReportTab', undefined, 'Per-Farm Report')}
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'analytics'
                ? 'bg-emerald-500 text-emerald-950 shadow-md font-extrabold'
                : 'text-emerald-300/70 hover:text-white'
            }`}
          >
            {t('reports.analyticsTab', undefined, 'Multi-Plot Analytics')}
          </button>
        </div>
      </div>

      {activeTab === 'farm-report' ? (
        <>
          {/* Farm Selector & Primary Action Bar */}
          <div className="glass-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border border-emerald-500/25 bg-gradient-to-r from-emerald-950/70 via-slate-900/80 to-emerald-950/70 shadow-xl">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
                <Sprout className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="block text-[10px] font-bold text-emerald-400 uppercase tracking-wider mb-0.5">
                  {t('reports.selectFarmPlot', undefined, 'Select Farm Plot')}
                </label>
                {farms.length > 0 ? (
                  <select
                    value={selectedFarm?.id || ''}
                    onChange={(e) => {
                      const f = farms.find((item) => item.id === e.target.value);
                      if (f) selectFarm(f);
                    }}
                    className="w-full max-w-sm bg-emerald-950/90 text-white font-bold text-xs py-1.5 px-3 rounded-lg border border-emerald-400/40 focus:outline-none focus:border-emerald-300 cursor-pointer shadow-inner"
                    title={t('reports.selectFarmPlot', undefined, 'Select Farm Plot')}
                  >
                    {farms.map((farm) => (
                      <option key={farm.id} value={farm.id} className="bg-slate-900 text-white">
                        {farm.name} ({farm.crop_type ? getDisplayCrop(farm.crop_type) : t('reports.cropUnspecified', undefined, 'Crop Unspecified')}
                        {farm.area_hectares ? ` • ${farm.area_hectares.toFixed(1)} ha` : ''})
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs text-emerald-300/60 font-medium">{t('reports.noRegisteredFarms', undefined, 'No registered farms')}</span>
                )}
              </div>
            </div>

            {/* Actions: Download PDF & Refresh */}
            <div className="flex items-center gap-2.5 flex-wrap shrink-0">
              <button
                onClick={() => selectedFarm?.id && loadFarmReport(selectedFarm.id)}
                disabled={loadingFarmReport}
                className="btn-secondary text-xs py-2 px-3 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                title={t('common.refresh', undefined, 'Refresh Data')}
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingFarmReport ? 'animate-spin' : ''}`} />
                <span>{t('common.refresh', undefined, 'Refresh')}</span>
              </button>

              <button
                onClick={handleDownloadPdf}
                disabled={downloadingPdf || !selectedFarm || loadingFarmReport}
                className="btn-primary text-xs py-2 px-4 flex items-center gap-2 font-black shadow-lg shadow-emerald-500/20 cursor-pointer disabled:opacity-50 transition-all hover:scale-[1.02]"
                title={t('reports.downloadPdf', undefined, 'Download PDF')}
              >
                <Download className={`w-4 h-4 ${downloadingPdf ? 'animate-bounce' : ''}`} />
                <span>{downloadingPdf ? t('reports.generatingPdf', undefined, 'Generating PDF...') : t('reports.downloadPdf', undefined, 'Download PDF')}</span>
              </button>
            </div>
          </div>

          {downloadSuccessMsg && (
            <div className="glass-card p-3 flex items-center gap-2 border border-emerald-500/40 bg-emerald-950/60 text-emerald-300 text-xs animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{downloadSuccessMsg}</span>
            </div>
          )}

          {farmReportError && (
            <div className="glass-card p-4 flex items-center justify-between border border-red-500/40 bg-red-950/40 text-red-300 text-xs animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <span>{farmReportError}</span>
              </div>
              <button
                onClick={() => selectedFarm?.id && loadFarmReport(selectedFarm.id)}
                className="btn-secondary text-xs py-1 px-2.5"
              >
                {t('common.retry', undefined, 'Retry')}
              </button>
            </div>
          )}

          {loadingFarmReport && !farmReport ? (
            <div className="space-y-4">
              <div className="h-28 skeleton rounded-2xl" />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="h-44 skeleton rounded-2xl" />
                <div className="h-44 skeleton rounded-2xl" />
              </div>
              <div className="h-60 skeleton rounded-2xl" />
            </div>
          ) : farmReport ? (
            <>
              {/* SECTION 1: Farm Overview & Health Summary Cards */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Farm Agronomic Details Card */}
                <div className="glass-card p-4 space-y-3 border border-emerald-500/20 lg:col-span-2">
                  <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
                    <div className="flex items-center gap-2">
                      <Sprout className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-sm font-extrabold text-white">
                        {t('reports.farmAgronomicProfile', undefined, 'Farm Agronomic Profile')}
                      </h2>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      {farmReport.farm.owner_name}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-left">
                    <div>
                      <span className="text-[10px] text-emerald-400/70 font-semibold block">{t('reports.farmName', undefined, 'Farm Name')}</span>
                      <span className="text-xs font-black text-white truncate block">{farmReport.farm.name}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-400/70 font-semibold block">{t('reports.primaryCrop', undefined, 'Primary Crop')}</span>
                      <span className="text-xs font-black text-emerald-300 block">{getDisplayCrop(farmReport.farm.crop_type)}</span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-400/70 font-semibold block">{t('reports.sowingDate', undefined, 'Crop Sowing Date')}</span>
                      <span
                        className={`text-xs font-black block ${
                          farmReport.farm.has_sowing_date ? 'text-white' : 'text-amber-300/80 italic'
                        }`}
                      >
                        {farmReport.farm.sowing_date || t('reports.notRecorded', undefined, 'Not recorded')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-400/70 font-semibold block">{t('reports.calculatedArea', undefined, 'Calculated Area')}</span>
                      <span className="text-xs font-black text-white block">
                        {farmReport.farm.area_hectares ? `${farmReport.farm.area_hectares.toFixed(2)} ha` : t('reports.notRecorded', undefined, 'Not recorded')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-400/70 font-semibold block">{t('reports.soilType', undefined, 'Soil Type')}</span>
                      <span className="text-xs font-bold text-slate-200 capitalize block">
                        {farmReport.farm.soil_type || t('reports.notRecorded', undefined, 'Not recorded')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-400/70 font-semibold block">{t('reports.irrigation', undefined, 'Irrigation')}</span>
                      <span className="text-xs font-bold text-slate-200 capitalize block">
                        {farmReport.farm.irrigation_type || t('reports.notRecorded', undefined, 'Not recorded')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-400/70 font-semibold block">{t('reports.districtState', undefined, 'District / State')}</span>
                      <span className="text-xs font-bold text-slate-200 truncate block">
                        {[farmReport.farm.district, farmReport.farm.state].filter(Boolean).join(', ') || t('reports.notRecorded', undefined, 'Not recorded')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-emerald-400/70 font-semibold block">{t('reports.coordinates', undefined, 'Coordinates')}</span>
                      <span className="text-xs font-bold text-slate-200 truncate block">
                        {farmReport.farm.latitude ? `${farmReport.farm.latitude.toFixed(2)}N, ${farmReport.farm.longitude?.toFixed(2)}E` : t('reports.notRecorded', undefined, 'Not recorded')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Live Farm Health Status Card */}
                <div className="glass-card p-4 space-y-3 border border-emerald-500/20 flex flex-col justify-between">
                  <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
                    <div className="flex items-center gap-2">
                      <Activity className="w-4 h-4 text-emerald-400" />
                      <h2 className="text-sm font-extrabold text-white">{t('reports.currentFarmStatus', undefined, 'Current Farm Status')}</h2>
                    </div>
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider"
                      style={{
                        backgroundColor: `${farmReport.status_summary.health_color}25`,
                        color: farmReport.status_summary.health_color,
                        border: `1px solid ${farmReport.status_summary.health_color}50`,
                      }}
                    >
                      {getLocalizedStatus(farmReport.status_summary.health_status)}
                    </span>
                  </div>

                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {farmReport.status_summary.description}
                  </p>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-emerald-500/15 text-center">
                    <div className="p-2 rounded-xl bg-emerald-950/50 border border-emerald-500/15">
                      <span className="text-[9px] text-emerald-300/70 font-bold block">{t('reports.ndviIndex', undefined, 'NDVI Index')}</span>
                      <span className="text-xs font-black text-white">{farmReport.status_summary.ndvi.toFixed(2)}</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-950/50 border border-emerald-500/15">
                      <span className="text-[9px] text-emerald-300/70 font-bold block">{t('reports.soilMoisture', undefined, 'Soil Moisture')}</span>
                      <span className="text-xs font-black text-white">{farmReport.status_summary.soil_moisture_pct.toFixed(0)}%</span>
                    </div>
                    <div className="p-2 rounded-xl bg-emerald-950/50 border border-emerald-500/15">
                      <span className="text-[9px] text-emerald-300/70 font-bold block">{t('reports.activeAlerts', undefined, 'Active Alerts')}</span>
                      <span className="text-xs font-black text-amber-300">{farmReport.status_summary.active_infections}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: Sowing-to-Harvest Timeline Guidance */}
              <div className="glass-card p-4 space-y-3 border border-emerald-500/20 text-left">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/15 pb-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-extrabold text-white">{t('reports.sowingTimeline', undefined, 'Sowing-to-Harvest Growth Timeline')}</h2>
                  </div>
                  <span className="text-[10px] text-emerald-300/60 font-medium">
                    {t('reports.estimatedGuidance', undefined, 'Estimated Agricultural Guidance')}
                  </span>
                </div>

                {farmReport.timeline.available ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                      <div>
                        <span className="text-emerald-400 font-bold">{farmReport.timeline.current_stage}</span>
                        <span className="text-slate-400 text-[11px] ml-2">
                          ({t('reports.dayOfCycle', { day: farmReport.timeline.days_elapsed, total: farmReport.timeline.total_cycle_days }, `Day ${farmReport.timeline.days_elapsed} of ~${farmReport.timeline.total_cycle_days}`)})
                        </span>
                      </div>
                      <div className="text-slate-300 text-[11px]">
                        {t('reports.estHarvestWindow', undefined, 'Est. Harvest Window')}: <span className="font-bold text-white">{farmReport.timeline.estimated_harvest_date}</span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="h-2 rounded-full bg-emerald-950 border border-emerald-500/30 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-500"
                        style={{ width: `${farmReport.timeline.progress_pct}%` }}
                      />
                    </div>

                    {farmReport.timeline.current_focus && (
                      <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-slate-300 flex items-start gap-2">
                        <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold text-emerald-300">{t('reports.stageAdvisory', undefined, 'Stage Advisory')}: </span>
                          {farmReport.timeline.current_focus}
                        </div>
                      </div>
                    )}

                    <p className="text-[10px] text-slate-400 italic">
                      <b>{t('reports.disclaimerTitle', undefined, 'Disclaimer')}:</b> {farmReport.timeline.disclaimer}
                    </p>
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-500/20 text-center space-y-1">
                    <p className="text-xs font-bold text-amber-300">
                      {farmReport.timeline.message || t('reports.sowingDateNotRecorded', undefined, 'Sowing date not recorded — timeline unavailable.')}
                    </p>
                    <p className="text-[11px] text-amber-200/70">
                      {t('reports.sowingDatePrompt', undefined, 'To activate crop-stage tracking and harvest estimation, please edit this farm and input your real sowing date.')}
                    </p>
                  </div>
                )}
              </div>

              {/* SECTION 3: Real Disease Detection History (This Farm Only) */}
              <div className="glass-card p-4 space-y-3 border border-emerald-500/20 text-left">
                <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-extrabold text-white">{t('reports.diseaseHistoryTitle', undefined, 'Disease Detection History')}</h2>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    {t('reports.recordsForPlot', { count: farmReport.disease_history.length }, `${farmReport.disease_history.length} Record(s) for this plot`)}
                  </span>
                </div>

                {farmReport.has_disease_records ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-emerald-500/20 text-emerald-300/70 text-[11px] font-bold">
                          <th className="py-2 px-3">{t('reports.thDiseaseName', undefined, 'Disease Name')}</th>
                          <th className="py-2 px-3">{t('reports.thDetectionDate', undefined, 'Detection Date')}</th>
                          <th className="py-2 px-3">{t('reports.thConfidence', undefined, 'Confidence')}</th>
                          <th className="py-2 px-3">{t('reports.thStatus', undefined, 'Current Status')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-500/10">
                        {farmReport.disease_history.map((record) => {
                          const isHealthy = record.disease.toLowerCase().includes('healthy');
                          return (
                            <tr key={record.id} className="hover:bg-emerald-950/30 transition">
                              <td className="py-2.5 px-3">
                                <span className="font-extrabold text-white block">{getDisplayDisease(record.disease, record.crop)}</span>
                                <span className="text-[10px] text-emerald-400/60 block">{getDisplayCrop(record.crop)}</span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                                {record.date_detected}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="font-bold text-white">{record.confidence_display}</span>
                              </td>
                              <td className="py-2.5 px-3">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-block whitespace-nowrap ${
                                    isHealthy
                                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                      : record.status.toLowerCase().includes('resolved')
                                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                  }`}
                                >
                                  {getLocalizedStatus(record.status)}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-6 text-center text-slate-400 text-xs">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400/40 mx-auto mb-2" />
                    <p className="font-bold text-emerald-300/80">{t('reports.noDetectionsRecorded', undefined, 'No disease detections recorded for this farm.')}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t('reports.scannerPrompt', undefined, 'Use the Disease Detection scanner anytime to capture leaf images and monitor crop health.')}
                    </p>
                  </div>
                )}
              </div>

              {/* SECTION 4: Real Treatment & Action History */}
              <div className="glass-card p-4 space-y-3 border border-emerald-500/20 text-left">
                <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
                  <div className="flex items-center gap-2">
                    <Droplets className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-extrabold text-white">{t('reports.treatmentHistoryTitle', undefined, 'Treatment & Action History')}</h2>
                  </div>
                  <button
                    onClick={() => setIsTreatmentModalOpen(true)}
                    className="btn-primary text-xs py-1 px-2.5 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>{t('reports.recordAction', undefined, 'Record Action')}</span>
                  </button>
                </div>

                {farmReport.has_treatment_records ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-emerald-500/20 text-emerald-300/70 text-[11px] font-bold">
                          <th className="py-2 px-3">{t('reports.thActionType', undefined, 'Action Type')}</th>
                          <th className="py-2 px-3">{t('reports.thDate', undefined, 'Date')}</th>
                          <th className="py-2 px-3">{t('reports.thDescription', undefined, 'Description')}</th>
                          <th className="py-2 px-3">{t('reports.thTargetDisease', undefined, 'Target / Disease')}</th>
                          <th className="py-2 px-3">{t('reports.thRecordedBy', undefined, 'Recorded By')}</th>
                          <th className="py-2 px-3 text-right">{t('reports.thDelete', undefined, 'Delete')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-emerald-500/10">
                        {farmReport.treatment_history.map((tItem) => (
                          <tr key={tItem.id} className="hover:bg-emerald-950/30 transition">
                            <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                              {getActionTypeLabel(tItem.action_type)}
                            </td>
                            <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                              {tItem.date_display || tItem.date}
                            </td>
                            <td className="py-2.5 px-3 text-slate-200">
                              <div>{tItem.description}</div>
                              {tItem.notes && <div className="text-[10px] text-slate-400 mt-0.5">{tItem.notes}</div>}
                            </td>
                            <td className="py-2.5 px-3 text-emerald-300 whitespace-nowrap">
                              {tItem.related_disease ? getDisplayDisease(tItem.related_disease) : t('common.none', undefined, 'General')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-400 text-[11px] whitespace-nowrap">
                              {tItem.recorded_by_name || t('roles.farmer', undefined, 'Farmer')}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <button
                                onClick={() => handleDeleteTreatment(tItem.id)}
                                className="p-1 text-red-400 hover:text-red-300 hover:bg-red-950/30 rounded transition cursor-pointer"
                                title={t('common.delete', undefined, 'Delete')}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-5 text-center text-slate-400 text-xs">
                    <p className="font-semibold text-slate-300">{t('reports.noTreatmentsRecorded', undefined, 'No treatment/action history recorded.')}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t('reports.treatmentLogPrompt', undefined, 'Log your fungicide sprays, fertilizer splits, and irrigation actions using the button above.')}
                    </p>
                  </div>
                )}
              </div>

              {/* SECTION 5: Real Weather-Aware Farm Alerts */}
              <div className="glass-card p-4 space-y-3 border border-emerald-500/20 text-left">
                <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
                  <div className="flex items-center gap-2">
                    <Cloud className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-extrabold text-white">{t('reports.weatherAlertsTitle', undefined, 'Weather-Aware Farm Alerts')}</h2>
                  </div>
                  {farmReport.weather.available && (
                    <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                      {farmReport.weather.temperature}°C • {farmReport.weather.description}
                    </span>
                  )}
                </div>

                {farmReport.weather.available ? (
                  <div className="space-y-2">
                    {farmReport.weather.alerts.map((alert, idx) => {
                      const isWarn = alert.level === 'warning';
                      return (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-start gap-2.5 ${
                            isWarn
                              ? 'bg-amber-950/30 border-amber-500/30 text-amber-200'
                              : 'bg-emerald-950/30 border-emerald-500/20 text-emerald-200'
                          }`}
                        >
                          <AlertTriangle className={`w-4 h-4 shrink-0 mt-0.5 ${isWarn ? 'text-amber-400' : 'text-emerald-400'}`} />
                          <div className="text-xs">
                            <span className="font-bold text-white block">{alert.title}</span>
                            <span className="text-[11px] text-slate-300 leading-relaxed block mt-0.5">
                              {alert.description}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">
                    {farmReport.weather.message || t('reports.weatherUnavailable', undefined, 'Weather information currently unavailable.')}
                  </p>
                )}
              </div>

              {/* SECTION 6: Report History */}
              <div className="glass-card p-4 space-y-3 border border-emerald-500/20 text-left">
                <div className="flex items-center justify-between border-b border-emerald-500/15 pb-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-emerald-400" />
                    <h2 className="text-sm font-extrabold text-white">{t('reports.reportHistoryTitle', undefined, 'Report History')}</h2>
                  </div>
                  <span className="text-[10px] text-slate-400">{t('reports.archivedPdfSubtitle', undefined, 'Archived official PDF generations')}</span>
                </div>

                {farmReport.report_history && farmReport.report_history.length > 0 ? (
                  <div className="space-y-2">
                    {farmReport.report_history.map((item) => (
                      <div
                        key={item.id}
                        className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-500/15 flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-emerald-400 shrink-0" />
                          <div className="truncate">
                            <span className="font-bold text-white block truncate">{item.file_name}</span>
                            <span className="text-[10px] text-slate-400 block">{item.generated_at}</span>
                          </div>
                        </div>

                        <button
                          onClick={handleDownloadPdf}
                          disabled={downloadingPdf}
                          className="btn-secondary text-[11px] py-1 px-2.5 flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <Download className="w-3 h-3" />
                          <span>{t('common.download', undefined, 'Download')}</span>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-4 text-center text-slate-400 text-xs">
                    <p className="font-medium text-slate-300">{t('reports.noReportsArchived', undefined, 'No previous reports generated for this farm yet.')}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t('reports.archiveFirstReportPrompt', undefined, 'Click the "Download PDF" button above to generate and archive your first official report.')}
                    </p>
                  </div>
                )}
              </div>
            </>
          ) : null}
        </>
      ) : (
        /* MULTI-PLOT ANALYTICS TAB */
        <div className="space-y-4 text-left">
          {/* Period selector */}
          <div className="glass-card p-3 flex items-center gap-2 flex-wrap border border-emerald-500/20">
            {['today', '7d', '30d', 'this_month', '365d'].map((pVal) => (
              <button
                key={pVal}
                onClick={() => setPeriod(pVal)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  period === pVal
                    ? 'bg-emerald-500 text-emerald-950 shadow-md font-extrabold'
                    : 'glass-pill text-emerald-300/70 hover:text-white'
                }`}
              >
                {getPeriodLabel(pVal)}
              </button>
            ))}
          </div>

          {loadingAnalytics ? (
            <div className="h-48 skeleton rounded-2xl" />
          ) : analyticsReport?.summary ? (
            <>
              <div className="dashboard-stats-grid">
                <div className="stat-card">
                  <div className="stat-card-icon bg-emerald-500/20 text-emerald-400">
                    <Sprout className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{analyticsReport.summary.total_farms}</div>
                    <div className="text-[10px] text-emerald-300/70 font-semibold">{t('dashboard.totalFarms', undefined, 'Total Farms')}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-icon bg-cyan-500/20 text-cyan-400">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{analyticsReport.summary.total_detections}</div>
                    <div className="text-[10px] text-emerald-300/70 font-semibold">{t('reports.thConfidence', undefined, 'Total Scans')}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-icon bg-red-500/20 text-red-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{analyticsReport.summary.disease_detections}</div>
                    <div className="text-[10px] text-emerald-300/70 font-semibold">{t('farmer.diseasesFound', undefined, 'Diseases Found')}</div>
                  </div>
                </div>

                <div className="stat-card">
                  <div className="stat-card-icon bg-emerald-500/20 text-emerald-400">
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xl font-black text-white">{analyticsReport.summary.healthy_detections}</div>
                    <div className="text-[10px] text-emerald-300/70 font-semibold">{t('dashboard.healthyCrops', undefined, 'Healthy Crops')}</div>
                  </div>
                </div>
              </div>

              {/* Disease breakdown */}
              {analyticsReport.disease_distribution && analyticsReport.disease_distribution.length > 0 && (
                <div className="glass-card p-4 space-y-3 border border-emerald-500/20">
                  <h3 className="text-sm font-bold text-white">{t('reports.diseaseSummary', undefined, 'Disease Distribution')} ({getPeriodLabel(period)})</h3>
                  <div className="space-y-2">
                    {analyticsReport.disease_distribution.map((d, i) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/10">
                        <span className="font-bold text-white">{getDisplayDisease(d.disease)}</span>
                        <span className="font-extrabold text-emerald-300">{d.count} {t('detection.analysis', undefined, 'detections')}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="glass-card p-6 text-center text-slate-400 text-xs">
              {t('reports.noReportsArchived', undefined, 'No aggregated analytics available for this period.')}
            </div>
          )}
        </div>
      )}

      {/* RECORD TREATMENT / ACTION MODAL */}
      {isTreatmentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-lg glass-panel p-5 rounded-2xl border border-emerald-500/30 text-left space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-emerald-500/20 pb-3">
              <div className="flex items-center gap-2">
                <Droplets className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-extrabold text-white">{t('reports.modalRecordActionTitle', undefined, 'Record Treatment / Action')}</h3>
              </div>
              <button
                onClick={() => setIsTreatmentModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTreatment} className="space-y-3.5 text-xs">
              {treatmentError && (
                <div className="p-2.5 rounded-xl bg-red-950/40 border border-red-500/30 text-red-300">
                  {treatmentError}
                </div>
              )}

              <div>
                <label className="block text-emerald-300 font-bold mb-1">{t('reports.modalActionType', undefined, 'Action Type *')}</label>
                <select
                  value={treatmentActionType}
                  onChange={(e) => setTreatmentActionType(e.target.value)}
                  className="glass-input cursor-pointer bg-emerald-950 text-white font-medium"
                >
                  {ACTION_TYPE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {getActionTypeLabel(opt)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-emerald-300 font-bold mb-1">{t('reports.modalDate', undefined, 'Date Applied / Performed *')}</label>
                <input
                  type="date"
                  value={treatmentDate}
                  onChange={(e) => setTreatmentDate(e.target.value)}
                  className="glass-input text-white cursor-pointer font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-bold mb-1">{t('reports.modalDescription', undefined, 'Action Description *')}</label>
                <input
                  type="text"
                  value={treatmentDescription}
                  onChange={(e) => setTreatmentDescription(e.target.value)}
                  placeholder="e.g. Tricyclazole 75 WP applied at 0.6g/L"
                  className="glass-input text-white font-medium"
                  required
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-bold mb-1">{t('reports.modalTargetDisease', undefined, 'Related Disease / Target (Optional)')}</label>
                <input
                  type="text"
                  value={treatmentRelatedDisease}
                  onChange={(e) => setTreatmentRelatedDisease(e.target.value)}
                  placeholder="e.g. Leaf Blast, Brown Spot, Nutrient Deficiency"
                  className="glass-input text-white font-medium"
                />
              </div>

              <div>
                <label className="block text-emerald-300 font-bold mb-1">{t('reports.modalNotes', undefined, 'Observations / Notes (Optional)')}</label>
                <textarea
                  value={treatmentNotes}
                  onChange={(e) => setTreatmentNotes(e.target.value)}
                  placeholder="e.g. Applied in early morning; foliage was dry. Follow up in 7 days."
                  rows={2}
                  className="glass-input text-white font-medium resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-500/20">
                <button
                  type="button"
                  onClick={() => setIsTreatmentModalOpen(false)}
                  className="btn-secondary py-2 px-3 text-xs"
                >
                  {t('common.cancel', undefined, 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={savingTreatment}
                  className="btn-primary py-2 px-4 text-xs font-bold disabled:opacity-50"
                >
                  {savingTreatment ? t('reports.modalSaving', undefined, 'Saving...') : t('reports.modalSave', undefined, 'Save to Database')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
