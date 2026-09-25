import React, { useState } from 'react';
import { 
  ArrowLeft, Shield, Users, Layers, Cpu, Activity, Database, 
  CheckCircle2, AlertTriangle, Clock, RefreshCw 
} from 'lucide-react';

interface AdminDashboardViewProps {
  onBack: () => void;
}

export const AdminDashboardView: React.FC<AdminDashboardViewProps> = ({ onBack }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'models' | 'audit'>('overview');

  const modelVersions = [
    {
      version: 'v1.2.0',
      architecture: 'EfficientNet-B0',
      dataset: 'PlantVillage (38 Classes)',
      accuracy: '96.4%',
      f1_score: '0.961',
      date: '2026-09-10',
      status: 'active',
      model_path: 'ml/weights/best_model.pth',
    },
    {
      version: 'v1.1.0',
      architecture: 'MobileNetV3-Large',
      dataset: 'PlantVillage + Field Crops',
      accuracy: '94.2%',
      f1_score: '0.938',
      date: '2026-08-18',
      status: 'deprecated',
      model_path: 'ml/weights/v1.1.0_mobilenet.pth',
    },
  ];

  const auditLogs = [
    {
      id: 'log-1',
      timestamp: '2026-09-13 14:48:12',
      user: 'farmer123',
      action: 'AI_DISEASE_DIAGNOSTICS',
      status: 'SUCCESS (96% Conf.)',
      ip: '192.168.1.42',
    },
    {
      id: 'log-2',
      timestamp: '2026-09-13 14:20:05',
      user: 'officer_singh',
      action: 'FIELD_REPORT_SUBMITTED',
      status: 'RESOLVED (Case #C108)',
      ip: '10.0.4.19',
    },
    {
      id: 'log-3',
      timestamp: '2026-09-13 13:55:40',
      user: 'farmer123',
      action: 'FARM_BOUNDARY_UPDATE',
      status: 'CALCULATED (2.4 ha)',
      ip: '192.168.1.42',
    },
    {
      id: 'log-4',
      timestamp: '2026-09-13 12:10:22',
      user: 'dr_ramesh',
      action: 'EXPERT_ADVISORY_SENT',
      status: 'MESSAGE_DELIVERED',
      ip: '172.16.8.91',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-full bg-emerald-950/80 border border-emerald-500/30 text-emerald-300 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="page-title font-bold text-white font-heading flex items-center gap-2">
              <span>Admin Management Command</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                ROOT PRIVILEGES
              </span>
            </h1>
            <p className="caption-text text-emerald-300/75">
              Infrastructure metrics, model version registry &amp; audit oversight
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.location.reload()}
            className="btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Telemetry</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2 text-xs">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            activeTab === 'overview'
              ? 'bg-emerald-500 text-emerald-950 shadow-md'
              : 'text-emerald-300 hover:text-white'
          }`}
        >
          System Health &amp; Overview
        </button>
        <button
          onClick={() => setActiveTab('models')}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            activeTab === 'models'
              ? 'bg-emerald-500 text-emerald-950 shadow-md'
              : 'text-emerald-300 hover:text-white'
          }`}
        >
          ML Model Version Registry
        </button>
        <button
          onClick={() => setActiveTab('audit')}
          className={`px-3 py-1.5 rounded-lg font-bold transition ${
            activeTab === 'audit'
              ? 'bg-emerald-500 text-emerald-950 shadow-md'
              : 'text-emerald-300 hover:text-white'
          }`}
        >
          Security Audit Logs
        </button>
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Top 4 System Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="glass-panel p-4 border-emerald-500/30 space-y-1">
              <span className="caption-text text-emerald-300/70">Registered Farmers</span>
              <div className="text-2xl font-black text-white font-heading">1,482</div>
              <div className="text-[10px] text-emerald-400 font-semibold">+18 this week</div>
            </div>
            <div className="glass-panel p-4 border-emerald-500/30 space-y-1">
              <span className="caption-text text-emerald-300/70">Total Monitored Parcels</span>
              <div className="text-2xl font-black text-white font-heading">3,619 ha</div>
              <div className="text-[10px] text-emerald-400 font-semibold">100% GeoJSON Validated</div>
            </div>
            <div className="glass-panel p-4 border-emerald-500/30 space-y-1">
              <span className="caption-text text-emerald-300/70">AI Diagnostic Inferences</span>
              <div className="text-2xl font-black text-white font-heading">18,940</div>
              <div className="text-[10px] text-emerald-400 font-semibold">96.4% Accuracy Baseline</div>
            </div>
            <div className="glass-panel p-4 border-emerald-500/30 space-y-1">
              <span className="caption-text text-emerald-300/70">Active Field Officers</span>
              <div className="text-2xl font-black text-white font-heading">24</div>
              <div className="text-[10px] text-emerald-400 font-semibold">Across 6 Districts</div>
            </div>
          </div>

          {/* Infrastructure Health Status */}
          <div className="glass-panel p-5 border-emerald-500/30 space-y-4">
            <h3 className="card-title font-bold text-white font-heading flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-400" />
              <span>Infrastructure Services Status</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">FastAPI Core API</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-emerald-300/70">Latency: 14ms • Port 8000</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">PyTorch Inference</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-emerald-300/70">EfficientNet-B0 Ready</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">PostgreSQL / PostGIS</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-emerald-300/70">Geospatial Index Active</p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/20 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">Esri Satellite Tiles</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                </div>
                <p className="text-[11px] text-emerald-300/70">ArcGIS CDN Operational</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Model Versions Tab */}
      {activeTab === 'models' && (
        <div className="glass-panel p-5 border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="card-title font-bold text-white font-heading flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>model_versions Database Table</span>
            </h3>
            <span className="text-xs text-emerald-300/80">PyTorch 2.x • Transfer Learning</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-emerald-500/20 text-emerald-300/80">
                  <th className="py-2.5 px-3">Version</th>
                  <th className="py-2.5 px-3">Architecture</th>
                  <th className="py-2.5 px-3">Dataset Source</th>
                  <th className="py-2.5 px-3">Val Accuracy</th>
                  <th className="py-2.5 px-3">F1 Score</th>
                  <th className="py-2.5 px-3">Training Date</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {modelVersions.map((mv) => (
                  <tr key={mv.version} className="hover:bg-emerald-950/40">
                    <td className="py-3 px-3 font-bold text-white">{mv.version}</td>
                    <td className="py-3 px-3 text-emerald-200">{mv.architecture}</td>
                    <td className="py-3 px-3 text-emerald-300/80">{mv.dataset}</td>
                    <td className="py-3 px-3 font-bold text-emerald-400">{mv.accuracy}</td>
                    <td className="py-3 px-3 text-emerald-300">{mv.f1_score}</td>
                    <td className="py-3 px-3 text-emerald-400/70">{mv.date}</td>
                    <td className="py-3 px-3">
                      <span className={mv.status === 'active' ? 'badge-risk-low' : 'badge-risk-medium'}>
                        {mv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Audit Logs Tab */}
      {activeTab === 'audit' && (
        <div className="glass-panel p-5 border-emerald-500/30 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="card-title font-bold text-white font-heading flex items-center gap-2">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Audit Logging &amp; Access History</span>
            </h3>
            <span className="text-xs text-emerald-300/80">Immutable Security Ledger</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-emerald-500/20 text-emerald-300/80">
                  <th className="py-2.5 px-3">Timestamp (UTC)</th>
                  <th className="py-2.5 px-3">User Subject</th>
                  <th className="py-2.5 px-3">Operation / Route</th>
                  <th className="py-2.5 px-3">Result / Payload</th>
                  <th className="py-2.5 px-3">Origin IP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-500/10">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-emerald-950/40 font-mono text-[11px]">
                    <td className="py-2.5 px-3 text-emerald-400/80">{log.timestamp}</td>
                    <td className="py-2.5 px-3 text-white font-bold">{log.user}</td>
                    <td className="py-2.5 px-3 text-emerald-200">{log.action}</td>
                    <td className="py-2.5 px-3 text-emerald-400">{log.status}</td>
                    <td className="py-2.5 px-3 text-emerald-400/60">{log.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
