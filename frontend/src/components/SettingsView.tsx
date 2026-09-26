import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, Lock, Bell, Globe, Info, LogOut, ChevronRight,
  HelpCircle, MessageSquare, Smartphone, Download, Share2, QrCode,
  Sprout, Plus, Edit2, Trash2, MapPin, CheckCircle2, AlertCircle, Loader2, RefreshCw
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { LanguageSelector } from './LanguageSelector';
import { authApi, farmsApi } from '../services/api';
import { Farm } from '../types';
import { ShareAppModal } from './ShareAppModal';
import { FarmCreateModal } from './FarmCreateModal';
import { FarmThumbnailMap } from './FarmThumbnailMap';
import { NotificationSettingsModal } from './NotificationSettingsModal';

interface SettingsViewProps {
  onBack: () => void;
  onLogout: () => void;
  onNavigateChat: () => void;
  onNavigateLibrary: () => void;
  onNavigateDownload?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  onBack,
  onLogout,
  onNavigateChat,
  onNavigateDownload,
}) => {
  const { user } = useAuth();
  const { t, languageInfo } = useLanguage();
  const role = (user?.role || '').toUpperCase();
  const canAddFarm = role === 'FARMER' || role === 'ADMIN';

  // Language section toggle state
  const [showLanguageOptions, setShowLanguageOptions] = useState(true);

  // Notifications Modal State
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);

  // Change Password state
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [pwMsg, setPwMsg] = useState('');
  const [pwError, setPwError] = useState('');

  // Farms Management State
  const [farms, setFarms] = useState<Farm[]>([]);
  const [loadingFarms, setLoadingFarms] = useState(true);
  const [farmsError, setFarmsError] = useState<string | null>(null);

  // Farm Modal State
  const [isFarmModalOpen, setIsFarmModalOpen] = useState(false);
  const [selectedFarmForEdit, setSelectedFarmForEdit] = useState<Farm | null>(null);

  // Delete Confirmation State
  const [farmToDelete, setFarmToDelete] = useState<Farm | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast State
  const [toastMsg, setToastMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMsg({ text, type });
    setTimeout(() => setToastMsg(null), 3500);
  };

  const loadFarms = async () => {
    if (!canAddFarm) {
      setLoadingFarms(false);
      return;
    }
    setLoadingFarms(true);
    setFarmsError(null);
    try {
      const res = await farmsApi.getFarms();
      setFarms(res.farms || []);
    } catch (err: any) {
      console.error('Failed to load farms in settings:', err);
      setFarmsError(err?.response?.data?.detail || 'Failed to load farm records.');
    } finally {
      setLoadingFarms(false);
    }
  };

  useEffect(() => {
    loadFarms();

    // Listen to global farm change events
    const handleFarmChanged = () => {
      loadFarms();
    };
    window.addEventListener('farm-data-changed', handleFarmChanged);
    return () => {
      window.removeEventListener('farm-data-changed', handleFarmChanged);
    };
  }, []);

  const handleOpenAddFarm = () => {
    if (!canAddFarm) return;
    setSelectedFarmForEdit(null);
    setIsFarmModalOpen(true);
  };

  const handleOpenEditFarm = (farm: Farm) => {
    setSelectedFarmForEdit(farm);
    setIsFarmModalOpen(true);
  };

  const handleFarmSaved = (savedFarm: Farm) => {
    showToast(
      selectedFarmForEdit
        ? `Farm "${savedFarm.name}" updated successfully.`
        : `Farm "${savedFarm.name}" added successfully.`
    );
    loadFarms();
  };

  const handleDeleteConfirm = async () => {
    if (!farmToDelete) return;
    setIsDeleting(true);
    try {
      await farmsApi.deleteFarm(farmToDelete.id);
      showToast(`Farm "${farmToDelete.name}" deleted successfully.`);

      // Dispatch event to sync across all screens
      window.dispatchEvent(
        new CustomEvent('farm-data-changed', {
          detail: { action: 'delete', farmId: farmToDelete.id },
        })
      );

      setFarmToDelete(null);
      loadFarms();
    } catch (err: any) {
      console.error('Failed to delete farm:', err);
      showToast(err?.response?.data?.detail || 'Failed to delete farm.', 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPw || !newPw || newPw.length < 8) {
      setPwError('New password must be at least 8 characters long.');
      return;
    }
    try {
      await authApi.changePassword(currentPw, newPw);
      setPwMsg('Password changed successfully!');
      setPwError('');
      setCurrentPw('');
      setNewPw('');
      setTimeout(() => { setShowChangePassword(false); setPwMsg(''); }, 2000);
    } catch (err: any) {
      setPwError(err?.response?.data?.detail || 'Failed to update password.');
    }
  };

  const guideSteps = [
    { num: 1, title: 'Select the crop', desc: 'Choose the crop affected.' },
    { num: 2, title: 'Browse diseases', desc: 'View symptoms and images.' },
    { num: 3, title: 'Check management', desc: 'Get treatment and prevention tips.' },
    { num: 4, title: 'Save for offline', desc: 'Access anytime, anywhere.' },
  ];

  return (
    <div className="space-y-4 animate-fade-in-up max-w-xl mx-auto select-none">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] max-w-sm w-full px-4 animate-fade-in">
          <div
            className={`p-3.5 rounded-xl shadow-2xl backdrop-blur-xl border flex items-center gap-2.5 text-xs font-bold ${
              toastMsg.type === 'success'
                ? 'bg-emerald-950/95 border-emerald-400 text-emerald-100'
                : 'bg-red-950/95 border-red-500 text-red-100'
            }`}
          >
            {toastMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span className="flex-1">{toastMsg.text}</span>
          </div>
        </div>
      )}

      {/* Sticky Header */}
      <div className="sticky top-0 z-30 -mt-2 py-3 bg-[#031c15]/95 backdrop-blur-xl border-b border-emerald-500/20 -mx-3 sm:-mx-6 px-3 sm:px-6 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="lg:hidden p-2 rounded-xl hover:bg-emerald-900/30 transition">
            <ArrowLeft className="w-5 h-5 text-emerald-300" />
          </button>
          <h1 className="text-xl font-black text-white font-heading">{t('settings.title', undefined, 'Settings & Profile')}</h1>
        </div>
      </div>

      {/* ── CARD: MY FARMS MANAGEMENT (REAL MAP-BASED) ────────────────── */}
      {canAddFarm && (
        <div className="glass-card p-5 space-y-4 border border-emerald-400/30 text-left shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sprout className="w-5 h-5 text-emerald-400" />
              <h2 className="text-sm font-black text-white font-heading">{t('farmer.myFarms', undefined, 'My Farms')}</h2>
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                {farms.length} {farms.length === 1 ? 'Field' : 'Fields'}
              </span>
            </div>
            {canAddFarm && (
              <button
                type="button"
                onClick={handleOpenAddFarm}
                className="btn-primary py-1.5 px-3 text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('farmer.addFarm', undefined, 'Add Farm')}</span>
              </button>
            )}
          </div>

          {/* Loading State */}
          {loadingFarms && (
            <div className="space-y-2 py-4">
              <div className="h-16 skeleton rounded-xl" />
              <div className="h-16 skeleton rounded-xl" />
            </div>
          )}

          {/* Error State */}
          {farmsError && !loadingFarms && (
            <div className="p-3 rounded-xl bg-red-950/60 border border-red-500/40 text-red-200 text-xs flex items-center justify-between">
              <span>{farmsError}</span>
              <button
                type="button"
                onClick={loadFarms}
                className="px-2.5 py-1 rounded bg-red-500/30 text-white font-bold flex items-center gap-1 text-[11px]"
              >
                <RefreshCw className="w-3 h-3" /> Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {!loadingFarms && !farmsError && farms.length === 0 && (
            <div className="p-6 rounded-2xl bg-emerald-950/40 border border-emerald-500/20 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center mx-auto text-emerald-400 shadow-md">
                <Sprout className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-black text-white font-heading">
                  You haven't added a farm yet
                </h3>
                <p className="text-xs text-emerald-300/70 mt-1 max-w-sm mx-auto leading-relaxed">
                  Define your field boundary on the interactive satellite map to get localized crop disease detection, soil moisture metrics, and NDVI satellite insights.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenAddFarm}
                className="btn-primary py-2 px-4 text-xs font-bold inline-flex items-center gap-1.5 shadow-[0_0_15px_rgba(16,185,129,0.3)] cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Your First Farm</span>
              </button>
            </div>
          )}

          {/* Real Farms List */}
          {!loadingFarms && !farmsError && farms.length > 0 && (
            <div className="space-y-2.5">
              {farms.map((farm) => (
                <div
                  key={farm.id}
                  className="p-3 rounded-xl bg-emerald-950/50 hover:bg-emerald-900/30 border border-emerald-500/25 transition flex items-center gap-3 group"
                >
                  {/* Miniature Map Preview Thumbnail */}
                  <div className="w-16 h-16 rounded-lg overflow-hidden border border-emerald-400/40 shrink-0 relative bg-emerald-950 shadow">
                    <FarmThumbnailMap farm={farm} />
                  </div>

                  {/* Farm Metadata */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-xs font-black text-white truncate">{farm.name}</h3>
                      <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        {farm.crop_type || 'Crop'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 mt-1 text-[11px] text-emerald-300/70 flex-wrap">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-emerald-400" />
                        {farm.district ? `${farm.district}, ` : ''}{farm.state || 'India'}
                      </span>
                      {farm.area_hectares && (
                        <span>• {farm.area_hectares.toFixed(1)} ha</span>
                      )}
                    </div>
                  </div>

                  {/* Actions: Edit & Delete */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleOpenEditFarm(farm)}
                      className="p-2 rounded-lg bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-500/30 text-emerald-300 hover:text-white transition cursor-pointer"
                      title="Edit farm boundary & details"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setFarmToDelete(farm)}
                      className="p-2 rounded-lg bg-red-950/40 hover:bg-red-900/60 border border-red-500/30 text-red-300 hover:text-white transition cursor-pointer"
                      title="Delete farm"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Card 1: Disease Library Guide */}
      <div className="glass-card p-5 space-y-4 border border-emerald-500/20 text-left">
        <h2 className="text-sm font-bold text-white">Disease Library Guide</h2>
        <div className="space-y-3.5">
          {guideSteps.map((step) => (
            <div key={step.num} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                {step.num}
              </div>
              <div className="text-xs">
                <span className="font-bold text-white">{step.title}</span>
                <span className="text-emerald-300/80"> — {step.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card 2: Quick Help */}
      <div className="glass-card p-5 space-y-3.5 border border-emerald-500/20 text-left">
        <h2 className="text-sm font-bold text-white">Quick Help</h2>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-cyan-500/15 border border-cyan-400/30 flex items-center justify-center flex-shrink-0">
            <HelpCircle className="w-5 h-5 text-cyan-400" />
          </div>
          <p className="text-xs text-emerald-200/80 leading-relaxed">
            Need help identifying a disease? Use the Expert Chat or upload photos for instant analysis.
          </p>
        </div>
        <button
          onClick={onNavigateChat}
          className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
        >
          <MessageSquare className="w-4 h-4 text-emerald-950" />
          <span>Go to Expert Chat</span>
        </button>
      </div>

      {/* Card: Install AgriGuard App */}
      {onNavigateDownload && (
        <div className="glass-card p-5 space-y-3.5 border border-emerald-400/30 bg-emerald-950/40 text-left shadow-lg">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-emerald-400" />
              <span>Get the AgriGuard Mobile App</span>
            </h2>
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PWA &amp; APK
            </span>
          </div>
          <p className="text-xs text-emerald-200/80 leading-relaxed">
            Install AgriGuard directly on your Android or iPhone for offline crop diagnosis, live camera scanning, and instant agronomist notifications.
          </p>
          <button
            onClick={onNavigateDownload}
            className="btn-primary w-full py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Download className="w-4 h-4 text-emerald-950" />
            <span>Download &amp; Install App</span>
          </button>
        </div>
      )}

      {/* Card: Share AgriGuard App to Another Device */}
      <div className="glass-card p-5 space-y-3.5 border border-emerald-400/30 bg-emerald-950/40 text-left shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Share2 className="w-4 h-4 text-emerald-400" />
            <span>Share App to Another Device</span>
          </h2>
          <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
            Share to Install
          </span>
        </div>
        <p className="text-xs text-emerald-200/80 leading-relaxed">
          Send AgriGuard to other farmers via WhatsApp, SMS, or QR code. The recipient gets an instant one-tap install or APK download on their phone.
        </p>
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={() => setShowShareModal(true)}
            className="btn-primary py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(16,185,129,0.3)]"
          >
            <Share2 className="w-4 h-4 text-emerald-950" />
            <span>Share App</span>
          </button>
          <button
            onClick={() => setShowShareModal(true)}
            className="btn-secondary py-2.5 text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer border border-emerald-500/40 hover:bg-emerald-900/40"
          >
            <QrCode className="w-4 h-4 text-emerald-400" />
            <span>Show QR Code</span>
          </button>
        </div>
      </div>

      {/* Card 3: Profile / Settings */}
      <div className="glass-card p-5 space-y-4 border border-emerald-500/20 text-left">
        <h2 className="text-sm font-bold text-white">{t('settings.profileAccount', undefined, 'Profile / Account')}</h2>

        {/* User Info Tile */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20">
          <div className="w-11 h-11 rounded-full overflow-hidden border-2 border-emerald-400/50 flex-shrink-0 shadow-md">
            <img
              src="/farmer_avatar.jpg"
              alt="Farmer avatar"
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150';
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-black text-white truncate">{user?.name || t('roles.farmer')}</p>
            <p className="text-xs text-emerald-300/60 truncate">{user?.email || 'farmer123@gmail.com'}</p>
          </div>
        </div>

        {/* Settings List */}
        <div className="space-y-1 divide-y divide-white/5">
          {/* Change Password */}
          <div className="pt-2">
            <button
              onClick={() => setShowChangePassword(!showChangePassword)}
              className="w-full py-2.5 flex items-center justify-between text-xs font-semibold text-white hover:text-emerald-300 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Lock className="w-4 h-4 text-emerald-400/80" />
                <span>{t('settings.changePassword', undefined, 'Change Password')}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400/40" />
            </button>

            {showChangePassword && (
              <form onSubmit={handleChangePassword} className="space-y-2 py-3 px-2">
                <input
                  type="password"
                  value={currentPw}
                  onChange={e => setCurrentPw(e.target.value)}
                  placeholder="Current Password"
                  className="glass-input text-xs"
                  required
                />
                <input
                  type="password"
                  value={newPw}
                  onChange={e => setNewPw(e.target.value)}
                  placeholder="New Password (8+ characters)"
                  className="glass-input text-xs"
                  required
                />
                {pwError && <p className="text-[11px] text-red-300">{pwError}</p>}
                {pwMsg && <p className="text-[11px] text-emerald-300">{pwMsg}</p>}
                <button type="submit" className="btn-primary text-xs py-2 w-full mt-1">
                  Update Password
                </button>
              </form>
            )}
          </div>

          {/* Notifications */}
          <div className="pt-2">
            <button
              onClick={() => setShowNotificationSettings(true)}
              className="w-full py-2.5 flex items-center justify-between text-xs font-semibold text-white hover:text-emerald-300 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Bell className="w-4 h-4 text-emerald-400/80" />
                <span>{t('settings.notifications', undefined, 'Notifications')}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400/40" />
            </button>
          </div>

          {/* Language Selection */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowLanguageOptions(!showLanguageOptions)}
              className="w-full py-2.5 flex items-center justify-between text-xs font-semibold text-white hover:text-emerald-300 transition cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <Globe className="w-4 h-4 text-emerald-400/80" />
                <span>{t('settings.language', undefined, 'Language')}</span>
              </div>
              <div className="flex items-center gap-1.5 text-emerald-300 font-bold">
                <span>{languageInfo.nativeName}</span>
                <ChevronRight className={`w-4 h-4 text-emerald-400/40 transition-transform ${showLanguageOptions ? 'rotate-90' : ''}`} />
              </div>
            </button>
            {showLanguageOptions && (
              <div className="pt-2 pb-1">
                <LanguageSelector variant="buttons" />
              </div>
            )}
          </div>

          {/* About AgriGuard */}
          <div className="pt-2">
            <button className="w-full py-2.5 flex items-center justify-between text-xs font-semibold text-white hover:text-emerald-300 transition cursor-pointer">
              <div className="flex items-center gap-3">
                <Info className="w-4 h-4 text-emerald-400/80" />
                <span>{t('settings.about', undefined, 'About AgriGuard')}</span>
              </div>
              <ChevronRight className="w-4 h-4 text-emerald-400/40" />
            </button>
          </div>
        </div>

        {/* Logout Button */}
        <button
          onClick={onLogout}
          className="w-full mt-3 py-2.5 rounded-xl border border-red-500/25 bg-red-950/30 hover:bg-red-900/50 text-red-400 text-xs font-bold flex items-center justify-center gap-2 transition cursor-pointer"
        >
          <LogOut className="w-4 h-4 stroke-[2.5]" />
          <span>{t('common.logout', undefined, 'Logout')}</span>
        </button>
      </div>

      {/* Share to Install Modal */}
      <ShareAppModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
      />

      {/* Farm Create / Edit Modal (Farmers / Admins only) */}
      {canAddFarm && (
        <FarmCreateModal
          isOpen={isFarmModalOpen}
          onClose={() => {
            setIsFarmModalOpen(false);
            setSelectedFarmForEdit(null);
          }}
          onSuccess={handleFarmSaved}
          farmToEdit={selectedFarmForEdit}
        />
      )}

      {/* Delete Confirmation Modal */}
      {farmToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in select-none">
          <div className="glass-panel p-6 max-w-sm w-full border border-red-500/40 shadow-2xl text-left space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/20 border border-red-400/40 flex items-center justify-center text-red-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-black text-white font-heading">Delete Farm?</h3>
                <p className="text-xs text-red-300/80">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-emerald-200/80 leading-relaxed">
              Are you sure you want to delete <strong className="text-white">"{farmToDelete.name}"</strong>? Historical crop disease scans and consultations will be safely preserved.
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-emerald-500/20">
              <button
                type="button"
                onClick={() => setFarmToDelete(null)}
                disabled={isDeleting}
                className="px-3.5 py-2 rounded-xl text-xs font-bold text-emerald-300 hover:text-white transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-lg transition cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Farm</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Notification Settings Modal */}
      <NotificationSettingsModal
        isOpen={showNotificationSettings}
        onClose={() => setShowNotificationSettings(false)}
      />
    </div>
  );
};
