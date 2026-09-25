import React, { useState } from 'react';
import { X, FileText, CheckCircle2, AlertCircle, Camera, Check } from 'lucide-react';
import { OfficerCase } from '../types';

interface FieldReportModalProps {
  caseItem: OfficerCase | null;
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reportData: any) => void;
}

export const FieldReportModal: React.FC<FieldReportModalProps> = ({
  caseItem,
  isOpen,
  onClose,
  onSubmit,
}) => {
  if (!isOpen) return null;

  const [title, setTitle] = useState(`Field Inspection: ${caseItem?.farm_name || 'Farm 1'}`);
  const [observations, setObservations] = useState(
    'Foliar examination revealed localized fungal lesions on lower leaves. Canopy aeration is restricted due to high planting density. Soil moisture index is adequate.'
  );
  const [recommendations, setRecommendations] = useState(
    '1. Apply Tricyclazole 75 WP @ 0.6g/L water at sunrise.\n2. Drain excess standing water for 48 hours to retard spore germination.\n3. Avoid further urea top-dressing.'
  );
  const [statusUpdate, setStatusUpdate] = useState('TREATMENT_RECOMMENDED');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      case_id: caseItem?.id,
      title,
      observations,
      recommendations,
      status: statusUpdate,
    });
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl glass-panel p-6 border-emerald-500/30 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white font-heading">
              Submit Official Field Report
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-emerald-900/50 text-emerald-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-emerald-300 font-semibold mb-1">Report Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="input-glass"
            />
          </div>

          <div>
            <label className="block text-emerald-300 font-semibold mb-1">On-Site Field Observations</label>
            <textarea
              rows={4}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              required
              className="input-glass leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-emerald-300 font-semibold mb-1">Agronomic Recommendations &amp; Prescription</label>
            <textarea
              rows={4}
              value={recommendations}
              onChange={(e) => setRecommendations(e.target.value)}
              required
              className="input-glass leading-relaxed"
            />
          </div>

          <div>
            <label className="block text-emerald-300 font-semibold mb-1">Update Case Status</label>
            <select
              value={statusUpdate}
              onChange={(e) => setStatusUpdate(e.target.value)}
              className="input-glass bg-[#061e16]"
            >
              <option value="TREATMENT_RECOMMENDED">TREATMENT_RECOMMENDED — Prescription delivered</option>
              <option value="UNDER_REVIEW">UNDER_REVIEW — Additional testing pending</option>
              <option value="RESOLVED">RESOLVED — Satisfactory resolution verified</option>
            </select>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-emerald-500/20">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-2 px-4 text-xs font-bold"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary py-2 px-5 text-xs font-bold flex items-center gap-1.5"
            >
              {isSuccess ? <Check className="w-4 h-4" /> : null}
              <span>{isSuccess ? 'Report Submitted!' : 'File Field Report'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
