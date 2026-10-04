import React, { useState } from 'react';
import { X, Calendar, MapPin, User, CheckCircle2, Clock } from 'lucide-react';
import { OfficerCase } from '../types';

interface FieldVisitModalProps {
  caseItem: OfficerCase | null;
  isOpen: boolean;
  onClose: () => void;
  onScheduled: (visitData: any) => void;
}

export const FieldVisitModal: React.FC<FieldVisitModalProps> = ({
  caseItem,
  isOpen,
  onClose,
  onScheduled,
}) => {
  if (!isOpen) return null;

  const [date, setDate] = useState('2026-09-15');
  const [time, setTime] = useState('10:00');
  const [purpose, setPurpose] = useState('Disease Verification & Severity Assessment');
  const [notes, setNotes] = useState('Conduct on-site foliar examination and soil moisture sampling.');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const visitData = {
      case_id: caseItem?.id,
      farm_name: caseItem?.farm_name || 'Farm 1',
      farmer_name: caseItem?.farmer_name || 'Farmer123',
      scheduled_date: `${date}T${time}:00`,
      purpose,
      notes,
      status: 'scheduled',
    };
    onScheduled(visitData);
    setIsSuccess(true);
    setTimeout(() => {
      setIsSuccess(false);
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl glass-panel p-6 border-emerald-500/30 max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white font-heading">
              Schedule Field Visit
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
          <div className="glass-card p-3 space-y-1 bg-emerald-950/40">
            <div className="font-bold text-white flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>{caseItem?.farm_name || 'Farm 1 - Rice'}</span>
            </div>
            <div className="text-emerald-300/80 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span>Farmer: {caseItem?.farmer_name || 'Farmer123'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-emerald-300 font-semibold mb-1">Inspection Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="input-glass bg-[#061e16]"
              />
            </div>
            <div>
              <label className="block text-emerald-300 font-semibold mb-1">Scheduled Time</label>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                className="input-glass bg-[#061e16]"
              />
            </div>
          </div>

          <div>
            <label className="block text-emerald-300 font-semibold mb-1">Visit Purpose</label>
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="input-glass bg-[#061e16]"
            >
              <option value="Disease Verification & Severity Assessment">Disease Verification &amp; Severity Assessment</option>
              <option value="Soil & Moisture Verification">Soil &amp; Moisture Verification</option>
              <option value="Treatment Application Demonstration">Treatment Application Demonstration</option>
              <option value="Pre-Harvest Yield Audit">Pre-Harvest Yield Audit</option>
            </select>
          </div>

          <div>
            <label className="block text-emerald-300 font-semibold mb-1">Field Instructions / Preparation Notes</label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input-glass"
            />
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
              {isSuccess && <CheckCircle2 className="w-4 h-4" />}
              <span>{isSuccess ? 'Visit Scheduled!' : 'Confirm Schedule'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
