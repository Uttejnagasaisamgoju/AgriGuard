import React, { useState } from 'react';
import { X, User, Mail, Phone, Globe, Shield, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const { user } = useAuth();
  const [name, setName] = useState(user?.name || 'Farmer123');
  const [email, setEmail] = useState(user?.email || 'farmer@demo.agriguard.app');
  const [phone, setPhone] = useState('+91 98480 22338');
  const [language, setLanguage] = useState('English');
  const [location, setLocation] = useState('Narsapur, Medak, Telangana');
  const [isSaved, setIsSaved] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="relative w-full max-w-md rounded-2xl glass-panel p-6 border-emerald-500/30 max-h-[90vh] overflow-y-auto space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-emerald-500/20">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white font-heading">
              Farmer Profile Information
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-emerald-900/50 text-emerald-400 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Avatar Card */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/25">
          <div className="w-14 h-14 rounded-2xl overflow-hidden border-2 border-emerald-400/40 flex-shrink-0">
            <img
              src={user?.profile_image || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'}
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">{name}</h3>
            <span className="badge-risk-low text-[10px] mt-0.5">{user?.role || 'FARMER'}</span>
            <div className="text-[11px] text-emerald-400/70 mt-1">{email}</div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3 text-xs">
          <div>
            <label className="block text-emerald-300 font-semibold mb-1">Full Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-glass"
              required
            />
          </div>

          <div>
            <label className="block text-emerald-300 font-semibold mb-1">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input-glass"
              required
            />
          </div>

          <div>
            <label className="block text-emerald-300 font-semibold mb-1">Mobile Phone Number</label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="input-glass"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-emerald-300 font-semibold mb-1">Preferred Language</label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="input-glass bg-[#061e16]"
              >
                <option value="English">English</option>
                <option value="Telugu">తెలుగు (Telugu)</option>
                <option value="Hindi">हिन्दी (Hindi)</option>
                <option value="Tamil">தமிழ் (Tamil)</option>
                <option value="Kannada">ಕನ್ನಡ (Kannada)</option>
              </select>
            </div>
            <div>
              <label className="block text-emerald-300 font-semibold mb-1">Farming Region</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="input-glass"
              />
            </div>
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
              {isSaved && <Check className="w-4 h-4" />}
              <span>{isSaved ? 'Updated!' : 'Save Profile'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
