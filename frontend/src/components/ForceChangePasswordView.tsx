import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { authApi } from '../services/api';
import { ShieldCheck, Lock, Eye, EyeOff, AlertCircle, CheckCircle2, LogOut, KeyRound } from 'lucide-react';

interface ForceChangePasswordViewProps {
  onSuccess: () => void;
}

export const ForceChangePasswordView: React.FC<ForceChangePasswordViewProps> = ({ onSuccess }) => {
  const { user, updateUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPasswords, setShowPasswords] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters in length.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    if (currentPassword === newPassword) {
      setError('Your new password must be different from your temporary password.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await authApi.changePassword(currentPassword, newPassword);
      setSuccessMsg('Password updated successfully! Redirecting to your dashboard...');
      
      if (response?.user) {
        updateUser(response.user);
      } else if (user) {
        updateUser({ ...user, must_change_password: false });
      }

      setTimeout(() => {
        onSuccess();
      }, 1000);
    } catch (err: any) {
      const detail = err?.response?.data?.detail || err?.message || 'Failed to update password. Please check your credentials.';
      setError(typeof detail === 'string' ? detail : JSON.stringify(detail));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 relative bg-cover bg-center select-none"
      style={{
        backgroundImage: `linear-gradient(rgba(3, 26, 20, 0.75), rgba(1, 14, 11, 0.90)), url('/agri_background.jpg')`,
      }}
    >
      <div className="glass-panel w-full max-w-[440px] p-6 sm:p-8 relative border border-emerald-400/30 shadow-[0_20px_60px_rgba(0,0,0,0.7)] backdrop-blur-2xl text-center animate-fade-in-up">
        {/* Security Shield Icon */}
        <div className="flex flex-col items-center mb-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center mb-2 shadow-[0_0_25px_rgba(245,158,11,0.35)]">
            <KeyRound className="w-7 h-7 text-amber-400 stroke-[2.5]" />
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white font-heading">
            Set Permanent Password
          </h1>
          <p className="text-emerald-200/80 text-xs mt-1 leading-relaxed max-w-sm">
            You signed in using a temporary password. For account security, you must set a new permanent password before continuing.
          </p>
        </div>

        {/* User Badge */}
        <div className="mb-4 py-1.5 px-3 rounded-lg bg-emerald-950/60 border border-emerald-500/25 flex items-center justify-between text-xs">
          <span className="text-emerald-300 font-semibold">{user?.name || user?.email}</span>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider">
            {user?.role || 'User'}
          </span>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-medium text-left flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div className="leading-snug">{error}</div>
          </div>
        )}

        {/* Success Alert */}
        {successMsg && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-200 text-xs font-medium text-left flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
            <div className="leading-snug">{successMsg}</div>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-left">
          {/* Current Temporary Password */}
          <div>
            <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
              Current Temporary Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70" />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter the password received in email"
                className="glass-input pl-9 pr-9 text-xs font-medium"
                required
              />
            </div>
          </div>

          {/* New Permanent Password */}
          <div>
            <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
              New Permanent Password
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70" />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                className="glass-input pl-9 pr-9 text-xs font-medium"
                required
                minLength={8}
              />
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-[11px] font-bold text-emerald-300 uppercase tracking-wider mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/70" />
              <input
                type={showPasswords ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your new permanent password"
                className="glass-input pl-9 pr-9 text-xs font-medium"
                required
                minLength={8}
              />
            </div>
          </div>

          {/* Show/Hide Passwords Toggle */}
          <div className="flex items-center justify-between text-xs pt-1">
            <button
              type="button"
              onClick={() => setShowPasswords(!showPasswords)}
              className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 hover:text-emerald-300 transition"
            >
              {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              <span>{showPasswords ? 'Hide passwords' : 'Show passwords'}</span>
            </button>
            <span className="text-[10px] text-emerald-300/60 font-mono">Min 8 chars</span>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading || !!successMsg}
            className="btn-primary w-full py-2.5 text-xs font-bold tracking-wide mt-2 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.35)]"
          >
            {isLoading ? (
              <span className="inline-block w-4 h-4 border-2 border-emerald-950 border-t-transparent rounded-full animate-spin" />
            ) : (
              'Update Password & Continue to Dashboard'
            )}
          </button>
        </form>

        {/* Cancel / Logout Option */}
        <div className="mt-5 pt-3 border-t border-emerald-500/20 flex justify-center">
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 text-xs text-emerald-300/70 hover:text-red-400 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign out / Cancel</span>
          </button>
        </div>
      </div>
    </div>
  );
};
