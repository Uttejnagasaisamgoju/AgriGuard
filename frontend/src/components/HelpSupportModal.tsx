import React, { useState } from 'react';
import { X, HelpCircle, PhoneCall, Mail, MessageSquare, ChevronDown, CheckCircle2 } from 'lucide-react';

interface HelpSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HelpSupportModal: React.FC<HelpSupportModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [ticketMsg, setTicketMsg] = useState('');
  const [isSent, setIsSent] = useState(false);

  const faqs = [
    {
      q: 'How accurate is the AI crop disease diagnostics?',
      a: 'The AgriGuard neural network evaluates multiple high-resolution leaf photos using EfficientNet deep learning trained on validated agricultural datasets. When confidence is above 80%, recommendations are actionable immediately. For confidence below 80%, consult a certified agricultural officer.',
    },
    {
      q: 'How do I draw and recalculate my farm parcel boundary?',
      a: 'Navigate to "My Farms" or "Satellite View". Select your farm, edit the parcel polygon, and click "Turf.js Recalculate" to instantly recompute real hectares from geodesic polygon geometry.',
    },
    {
      q: 'How does live communication with field officers work?',
      a: 'When an AI scan indicates high disease risk, an officer case is automatically registered in your district queue. The field officer can review the imagery, schedule an on-site visit, or prescribe treatment directly via Expert Chat.',
    },
    {
      q: 'Can I use AgriGuard without an internet connection?',
      a: 'Yes, AgriGuard implements PWA caching for offline disease library guides, recent diagnostic results, and saved farm boundaries.',
    },
  ];

  const handleTicketSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSent(true);
    setTimeout(() => {
      setIsSent(false);
      setTicketMsg('');
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-lg rounded-2xl glass-panel p-6 border-emerald-500/30 max-h-[90vh] overflow-y-auto space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <HelpCircle className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white font-heading">
              AgriGuard Help &amp; Farmer Support
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-emerald-900/50 text-emerald-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Emergency Helplines */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="glass-card p-3 space-y-1 bg-emerald-950/40 border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <PhoneCall className="w-4 h-4" />
              <span>Kisan Call Centre (Toll Free)</span>
            </div>
            <div className="text-base font-black text-white font-heading">1800-180-1551</div>
            <div className="text-[10px] text-emerald-300/70">24x7 Government Agronomic Assistance</div>
          </div>

          <div className="glass-card p-3 space-y-1 bg-emerald-950/40 border-emerald-500/30">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
              <Mail className="w-4 h-4" />
              <span>AgriGuard Technical Desk</span>
            </div>
            <div className="text-sm font-bold text-white">support@agriguard.app</div>
            <div className="text-[10px] text-emerald-300/70">Response within 2 hours</div>
          </div>
        </div>

        {/* FAQs Accordion */}
        <div className="space-y-2">
          <h3 className="text-xs font-bold text-emerald-300 uppercase tracking-wider">
            Frequently Asked Questions
          </h3>
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="p-3 rounded-xl bg-emerald-950/50 border border-emerald-500/20 space-y-1 cursor-pointer"
              onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
            >
              <div className="flex items-center justify-between text-xs font-bold text-white">
                <span>{faq.q}</span>
                <ChevronDown
                  className={`w-4 h-4 text-emerald-400 transition-transform ${
                    openFaq === idx ? 'transform rotate-180' : ''
                  }`}
                />
              </div>
              {openFaq === idx && (
                <p className="text-[11px] text-emerald-200/80 pt-1 leading-relaxed border-t border-emerald-500/10 mt-1">
                  {faq.a}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Quick Ticket Form */}
        <form onSubmit={handleTicketSubmit} className="space-y-2 text-xs pt-1 border-t border-emerald-500/20">
          <label className="block text-emerald-300 font-semibold">Need custom agricultural assistance?</label>
          <textarea
            rows={2}
            value={ticketMsg}
            onChange={(e) => setTicketMsg(e.target.value)}
            placeholder="Describe your crop symptom or query for the extension agronomist..."
            className="input-glass"
            required
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary py-1.5 px-4 text-xs font-bold"
            >
              Close
            </button>
            <button
              type="submit"
              className="btn-primary py-1.5 px-5 text-xs font-bold flex items-center gap-1.5"
            >
              {isSent ? <CheckCircle2 className="w-4 h-4" /> : null}
              <span>{isSent ? 'Query Dispatched!' : 'Submit Query'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
